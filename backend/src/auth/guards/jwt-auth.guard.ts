import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer '))
      throw new UnauthorizedException();
    const session = await this.auth.session(header.slice(7));
    request.user = {
      worker_id: session.sub,
      username: session.username,
      role: session.role,
      roles: session.roles,
    };
    return true;
  }
}
