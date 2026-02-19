import { PartialType } from '@nestjs/mapped-types';
import { CreateOfficialDto } from './create-official.dto';

export class UpdateOfficialDto extends PartialType(CreateOfficialDto) { }
