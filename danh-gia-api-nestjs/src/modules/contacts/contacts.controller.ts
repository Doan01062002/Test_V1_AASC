import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiSecurity,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';

@ApiTags('Contacts')
@ApiSecurity('x-api-key')
@UseGuards(ApiKeyGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách contact kèm thông tin ngân hàng' })
  @ApiResponse({ status: 200, description: 'Danh sách contact và banking requisites' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực qua x-api-key' })
  async getContacts() {
    return this.contactsService.getContacts();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết contact theo ID' })
  @ApiParam({ name: 'id', description: 'ID của contact trên Bitrix24', type: Number })
  @ApiResponse({ status: 200, description: 'Thông tin contact và banking requisites' })
  @ApiResponse({ status: 404, description: 'Contact không tồn tại' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực qua x-api-key' })
  async getContactById(@Param('id', ParseIntPipe) id: number) {
    return this.contactsService.getContactById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Tạo mới contact và tự động tạo thông tin ngân hàng Requisite',
  })
  @ApiResponse({ status: 201, description: 'Contact và requisite tạo thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực qua x-api-key' })
  async createContact(@Body() createContactDto: CreateContactDto) {
    return this.contactsService.createContact(createContactDto);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Cập nhật thông tin contact và thông tin ngân hàng theo ID',
  })
  @ApiParam({ name: 'id', description: 'ID của contact trên Bitrix24', type: Number })
  @ApiResponse({ status: 200, description: 'Cập nhật contact thành công' })
  @ApiResponse({ status: 404, description: 'Contact không tồn tại' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực qua x-api-key' })
  async updateContact(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateContactDto: UpdateContactDto,
  ) {
    return this.contactsService.updateContact(id, updateContactDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa contact và requisites liên quan theo ID' })
  @ApiParam({ name: 'id', description: 'ID của contact trên Bitrix24', type: Number })
  @ApiResponse({ status: 200, description: 'Xóa contact thành công' })
  @ApiResponse({ status: 404, description: 'Contact không tồn tại' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực qua x-api-key' })
  async deleteContact(@Param('id', ParseIntPipe) id: number) {
    return this.contactsService.deleteContact(id);
  }
}
