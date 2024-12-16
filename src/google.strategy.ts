import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { PrismaService } from './PrismaModule/prisma.service';
import { google } from 'googleapis'; 

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private prisma: PrismaService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: 'http://localhost:5000/auth/google-redirect',
      scope: ['email', 'profile'],
      prompt: 'consent',
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    console.log("acessToken:", accessToken);
    console.log("refreshToken:", refreshToken);
    console.log("profile:", profile);
    const { name, emails, photos } = profile;
    const user = {
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName,
      picture: photos[0].value,
      accessToken,
      refreshToken,
    };

    console.log("UserDetails:", user);

    let existingUser = await this.prisma.oauthUsers.findUnique({
      where: { email: user.email },
    });

    if (!existingUser) {
      existingUser = await this.prisma.oauthUsers.create({
        data: user,
      });
    } else {
      if (!existingUser.accessToken) {
        const refreshedAccessToken = await this.refreshAccessToken(existingUser.refreshToken);

        existingUser = await this.prisma.oauthUsers.update({
          where: { email: user.email },
          data: { accessToken: refreshedAccessToken },
        });
      }
    }

    done(null, existingUser);
  }

  // Function to refresh the access token using the refresh token
  async refreshAccessToken(refreshToken: string): Promise<string> {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'http://localhost:5000/auth/google-redirect',
    );

    oauth2Client.setCredentials({ refresh_token: refreshToken });

    try {
      const tokens = await oauth2Client.refreshAccessToken();
      return tokens.credentials.access_token;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw new Error('Unable to refresh access token');
    }
  }
}
