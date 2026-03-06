import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from './payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepo: Repository<Payment>,
    private configService: ConfigService,
  ) {}

  async create(createPaymentDto: CreatePaymentDto, userId: number): Promise<any> {
    const chapaUrl = this.configService.get<string>('CHAPA_URL') || 'https://api.chapa.co/v1';
    const chapaAuth = this.configService.get<string>('CHAPA_SECRET_KEY');

    if (!chapaAuth) {
      throw new HttpException('Chapa secret key not configured', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // Fetch the user to get email and phone details automatically
    const user = await this.paymentsRepo.manager.findOne('User', { where: { id: userId } }) as any;
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    const tx_ref = `tx-${userId}-${Date.now()}`;

    try {
      const response = await axios.post(
        `${chapaUrl}/transaction/initialize`,
        {
          amount: createPaymentDto.amount,
          currency: createPaymentDto.currency,
          // Fallback to a constructed email if the user registered with phone only
          email: user.email || `${user.phone}@domain.com`,
          first_name: user.firstName || 'User', // Fallback if missing
          last_name: user.lastName || user.id.toString(),
          phone_number: user.phone,
          tx_ref: tx_ref,
          'subaccounts[id]': this.configService.get<string>('CHAPA_SUBACCOUNT_ID'),
          return_url: createPaymentDto.return_url,
          callback_url: this.configService.get<string>('CHAPA_WEBHOOK_URL'),
        },
        {
          headers: {
            Authorization: `Bearer ${chapaAuth}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.data.status === 'success') {
        // Save initial pending payment record
        const payment = this.paymentsRepo.create({
          amount: createPaymentDto.amount,
          currency: createPaymentDto.currency,
          tx_ref: tx_ref,
          checkout_url: response.data.data.checkout_url,
          status: PaymentStatus.PENDING,
          user: { id: userId } as any,
        });
        await this.paymentsRepo.save(payment);

        return {
          message: 'Payment initialized',
          checkoutUrl: response.data.data.checkout_url,
          reference: tx_ref,
        };
      } else {
        throw new HttpException(response.data.message || 'Payment initialization failed', HttpStatus.BAD_REQUEST);
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error.response?.data?.message || 'Error communicating with payment gateway',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async findByReference(reference: string): Promise<Payment | null> {
    return this.paymentsRepo.findOne({ 
      where: { tx_ref: reference },
      relations: ['user'], // Ensure we load the user relation to check ownership
    });
  }

  async verify(reference: string, userId: number): Promise<Payment> {
    const chapaUrl = this.configService.get<string>('CHAPA_URL') || 'https://api.chapa.co/v1';
    const chapaAuth = this.configService.get<string>('CHAPA_SECRET_KEY');

    if (!chapaAuth) {
      throw new HttpException('Chapa secret key not configured', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const payment = await this.findByReference(reference);
    if (!payment) {
      throw new HttpException('Payment reference not found', HttpStatus.NOT_FOUND);
    }

    // Ensure the user trying to verify the payment actually owns it
    if (payment.user?.id !== userId) {
      throw new HttpException('You do not have permission to verify this payment', HttpStatus.FORBIDDEN);
    }

    try {
      const response = await axios.get(`${chapaUrl}/transaction/verify/${reference}`, {
        headers: {
          Authorization: `Bearer ${chapaAuth}`,
        },
      });

      if (response.data.status === 'success') {
        const txData = response.data.data;
        const finalRefId = txData?.reference || payment.ref_id;
        
        await this.paymentsRepo.update(payment.id, {
          status: PaymentStatus.COMPLETED,
          ref_id: finalRefId,
        });
        
        return { ...payment, status: PaymentStatus.COMPLETED, ref_id: finalRefId } as Payment;
      } else {
        await this.paymentsRepo.update(payment.id, {
          status: PaymentStatus.FAILED,
        });
        
        return { ...payment, status: PaymentStatus.FAILED } as Payment;
      }
    } catch (error) {
       if (error instanceof HttpException) throw error;
       throw new HttpException(
         error.response?.data?.message || 'Error communicating with payment gateway',
         HttpStatus.BAD_GATEWAY,
       );
    }
  }

  async handleWebhook(payload: any, signature: string): Promise<void> {
    const chapaAuth = this.configService.get<string>('CHAPA_SECRET_KEY');
    if (!chapaAuth) {
      throw new HttpException('Chapa secret key not configured', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // Verify the webhook signature using crypto
    const crypto = await import('crypto');
    const hash = crypto
      .createHmac('sha256', chapaAuth)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (hash !== signature) {
      throw new HttpException('Invalid webhook signature', HttpStatus.UNAUTHORIZED);
    }

    // Process the event
    if (payload.event === 'charge.success') {
      const reference = payload.tx_ref;
      const payment = await this.findByReference(reference);
      
      if (payment && payment.status === PaymentStatus.PENDING) {
        payment.status = PaymentStatus.COMPLETED;
        payment.ref_id = payload.reference || payment.ref_id;
        await this.paymentsRepo.save(payment);
      }
    }
  }
}
