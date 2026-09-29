import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ReviewsService } from './reviews.service.js';
import type { CreateReviewDto } from './reviews.service.js';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  create(@Body() body: CreateReviewDto) {
    return this.reviewsService.createReview(body);
  }

  @Get('service/:serviceId')
  byService(@Param('serviceId') serviceId: string) {
    return this.reviewsService.getByService(serviceId);
  }
}
