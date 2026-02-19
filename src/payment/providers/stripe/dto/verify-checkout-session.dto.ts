import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyCheckoutSessionDto {
  @IsNotEmpty({ message: 'session_id is required' })
  @IsString({ message: 'session_id must be a string' })
  session_id: string;
}
