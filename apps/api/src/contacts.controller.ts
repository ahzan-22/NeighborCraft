import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import {
  ContactsService,
  type CreateContactDto,
  type UpdateContactDto,
} from './contacts.service.js';

@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  findAll() {
    return this.contactsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contactsService.findOne(id);
  }

  @Post()
  create(@Body() body: CreateContactDto) {
    return this.contactsService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateContactDto) {
    return this.contactsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contactsService.remove(id);
  }
}
