import {
  Body,
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  Request,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { Payment } from './payment.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiBearerAuth('bearerAuth')
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiCreatedResponse({ description: 'Payment initialized successfully' })
  @ApiBadRequestResponse({ description: 'Invalid payment data' })
  create(@Body() dto: CreatePaymentDto, @Request() req: any): Promise<any> {
    const userId = req.user?.id;
    return this.paymentsService.create(dto, userId);
  }

  @ApiBearerAuth('bearerAuth')
  @UseGuards(JwtAuthGuard)
  @Get('verify/:reference')
  @ApiCreatedResponse({
    description: 'Payment verified successfully',
    type: Payment,
  })
  verify(@Param('reference') reference: string, @Request() req: any): Promise<Payment> {
    const userId = req.user?.id;
    return this.paymentsService.verify(reference, userId);
  }

  @Post('webhook')
  async chapaWebhook(
    @Body() payload: any,
    @Headers('chapa-signature') signature: string,
  ) {
    if (signature) {
      await this.paymentsService.handleWebhook(payload, signature);
    }
    return { status: 'success' };
  }
}
