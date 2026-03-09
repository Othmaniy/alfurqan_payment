import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto } from '../users/dto/create-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: CreateUserDto) {
    const byPhone = await this.usersService.findByPhone(dto.phone);
    if (byPhone) throw new BadRequestException('Phone already registered');
    const byEmail = await this.usersService.findByEmail(dto.email);
    if (byEmail) throw new BadRequestException('Email already registered');

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({ ...dto, password: hashed });
    
    // Generate token for the new user
    const payload = { sub: user.id, phone: user.phone, email: user.email, role: user.role };
    const access_token = this.jwtService.sign(payload);

    return { user, access_token };
  }

  async login(phone: string, password: string) {
    const user = await this.usersService.findByPhone(phone);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const payload = { sub: user.id, phone: user.phone, email: user.email, role: user.role };
    return { access_token: this.jwtService.sign(payload) };
  }

  async checkPhoneExists(phone: string) {
    const user = await this.usersService.findByPhone(phone);
    return { exists: !!user };
  }
}
