import {
	BadRequestException,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { SignUpDto } from './dto/signup.dto';
import { AuthUser } from './interfaces/auth-user.interface';
import { JwtPayload } from './interfaces/jwt-payload.interface';

export interface AuthResponse {
	accessToken: string;
	user: AuthUser;
}

@Injectable()
export class AuthService {
	private readonly saltRounds = 10;

	constructor(
		private readonly prisma: PrismaService,
		private readonly jwtService: JwtService,
	) {}

	async signUp(dto: SignUpDto): Promise<AuthResponse> {
		const existingUser = await this.prisma.user.findUnique({
			where: { email: dto.email },
		});

		if (existingUser) {
			throw new BadRequestException('Email is already in use');
		}

		const hashedPassword = await bcrypt.hash(dto.password, this.saltRounds);

		const user = await this.prisma.user.create({
			data: {
				email: dto.email,
				password: hashedPassword,
			},
		});

		return this.issueToken({ id: user.id, email: user.email });
	}

	async validateUser(email: string, password: string): Promise<AuthUser | null> {
		const user = await this.prisma.user.findUnique({ where: { email } });

		if (!user) {
			return null;
		}

		const isPasswordValid = await bcrypt.compare(password, user.password);
		if (!isPasswordValid) {
			return null;
		}

		return {
			id: user.id,
			email: user.email,
		};
	}

	async login(dto: LoginDto): Promise<AuthResponse> {
		const user = await this.validateUser(dto.email, dto.password);

		if (!user) {
			throw new UnauthorizedException('Invalid credentials');
		}

		return this.issueToken(user);
	}

	private async issueToken(user: AuthUser): Promise<AuthResponse> {
		const payload: JwtPayload = {
			sub: user.id,
			email: user.email,
		};

		const accessToken = await this.jwtService.signAsync(payload);

		return {
			accessToken,
			user,
		};
	}
}
