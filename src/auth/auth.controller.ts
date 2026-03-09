import { Body, Controller, Post, UseGuards, Get, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiCreatedResponse({ description: 'User registered' })
  @ApiBadRequestResponse({
    description: 'Invalid input or user already exists',
  })
  async register(@Body() dto: CreateUserDto) {
    const { user, access_token } = await this.authService.register(dto);
    const { password, ...userData } = user as any;
    return {
      message: 'Registration successful',
      user: userData,
      access_token,
    };
  }

  @Post('login')
  @ApiOkResponse({ description: 'JWT access token' })
  @ApiBadRequestResponse({ description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto.phone, dto.password);
    return {
      message: 'Login successful',
      ...result,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearerAuth')
  @ApiOkResponse({ description: 'Current user information' })
  me(@Request() req: any, @CurrentUser() user: any) {
    // Return both to demonstrate values available
    return { fromReq: req.user, fromDecorator: user };
  }
}
