import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Min, IsOptional, IsEmail } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ description: 'Amount in the smallest currency unit', example: 100.5 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ description: 'Currency code', example: 'ETB' })
  @IsString()
  currency: string;


  @ApiProperty({ description: 'Return URL after payment', example: 'https://example.com/return' })
  @IsOptional()
  @IsString()
  return_url?: string;
}
