import { Controller, Get, Patch, Param, Body } from '@nestjs/common';
import { ObjectsService } from './services/objects.service';
import { UpdateObjectDto } from './dto/update-object.dto';

@Controller('objects')
export class ObjectsController {
  constructor(private readonly objectsService: ObjectsService) {}

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.objectsService.findOne(+id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateObjectDto: UpdateObjectDto) {
    return this.objectsService.update(+id, updateObjectDto);
  }
}