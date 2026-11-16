import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Post,
} from '@nestjs/common';
import type { LoginRequestDto } from './dto/login-request.dto';
import { AuthService } from './auth.service';

@Controller('wkms/auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
    ) {}

    @Post('login')
    @HttpCode(HttpStatus.OK)
    login(
        @Body() body: LoginRequestDto,
    ) {
        return this.authService.login(body);
    }
}