import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Payment } from '../payments/payment.entity';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
/**
 * Persistent representation of application user
 */
@Entity()
export class User {
  @ApiProperty({ description: 'Auto-generated primary key' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'Unique phone number for the user' })
  @IsString()
  @IsNotEmpty()
  @Column({ unique: true })
  phone: string;

  @ApiProperty({ description: 'User first name' })
  @IsString()
  @Column({ nullable: true })
  firstName: string;

  @ApiProperty({ description: 'User last name' })
  @IsString()
  @Column({ nullable: true })
  lastName: string;

  @ApiProperty({ description: 'Hashed password', minLength: 6 })
  @IsString()
  @MinLength(6)
  @Column()
  password: string;

  @ApiProperty({ description: 'Unique email address' })
  @IsEmail()
  @Column({ unique: true, nullable: true })
  email: string;

  @OneToMany(() => Payment, (payment) => payment.user)
  payments: Payment[];
}
