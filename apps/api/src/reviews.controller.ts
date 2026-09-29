import { Controller, Post, Get, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ReviewsService } from './reviews.service.js';
import type { CreateReviewDto } from './reviews.service.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import type { JwtPayload } from './auth/jwt-auth.guard.js';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() body: CreateReviewDto, @Req() req: { user: JwtPayload }) {
    // userId selalu dari JWT, abaikan nilai di body.
    return this.reviewsService.createReview({ ...body, userId: req.user.sub });
  }

  @Get('service/:serviceId')
  byService(@Param('serviceId') serviceId: string) {
    return this.reviewsService.getByService(serviceId);
  }
}
