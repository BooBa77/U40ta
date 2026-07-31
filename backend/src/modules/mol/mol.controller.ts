import {
    Controller,
    Post,
    Get,
    Delete,
    Body,
    Param,
    UseGuards,
    Req,
    UnauthorizedException,
    BadRequestException,
    ConflictException,
    NotFoundException,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MolService } from './services/mol.service';
import { IgnoreKeywordsService } from './services/ignore-keywords.service';
import type { RequestWithUser } from '../../common/interfaces/request-with-user.interface';

@Controller('mol')
@UseGuards(JwtAuthGuard)
export class MolController {
    constructor(
        private readonly molService: MolService,
        private readonly ignoreKeywordsService: IgnoreKeywordsService,
    ) {}

    /**
     * Экспорт доступных объектов МОЛа в Excel
     * POST /api/mol/export-excel
     */
    @Post('export-excel')
    @HttpCode(HttpStatus.OK)
    async exportExcel(@Req() request: RequestWithUser) {
        const userId = request.user?.sub;
        if (!userId) {
            throw new UnauthorizedException('Пользователь не авторизован');
        }

        return await this.molService.exportExcel(userId);
    }

    // ============================================================================
    // ИГНОР-СЛОВА
    // ============================================================================

    /**
     * Получить все игнор-слова текущего пользователя.
     * GET /api/mol/ignore-keywords
     */
    @Get('ignore-keywords')
    async getIgnoreKeywords(@Req() request: RequestWithUser) {
        const userId = request.user?.sub;
        if (!userId) {
            throw new UnauthorizedException('Пользователь не авторизован');
        }

        const keywords = await this.ignoreKeywordsService.getKeywords(userId);
        return { keywords };
    }

    /**
     * Добавить игнор-слово.
     * POST /api/mol/ignore-keywords
     */
    @Post('ignore-keywords')
    @HttpCode(HttpStatus.CREATED)
    async addIgnoreKeyword(
        @Req() request: RequestWithUser,
        @Body() body: { keyword: string }
    ) {
        const userId = request.user?.sub;
        if (!userId) {
            throw new UnauthorizedException('Пользователь не авторизован');
        }

        if (!body.keyword || body.keyword.trim().length === 0) {
            throw new BadRequestException('Ключевое слово не может быть пустым');
        }

        try {
            const result = await this.ignoreKeywordsService.addKeyword(userId, body.keyword);
            return { success: true, keyword: result };
        } catch (error) {
            if (error instanceof ConflictException) {
                throw error;
            }
            throw new BadRequestException('Ошибка при добавлении ключевого слова');
        }
    }

    /**
     * Удалить игнор-слово по ID.
     * DELETE /api/mol/ignore-keywords/:id
     */
    @Delete('ignore-keywords/:id')
    @HttpCode(HttpStatus.OK)
    async removeIgnoreKeyword(
        @Req() request: RequestWithUser,
        @Param('id') id: string
    ) {
        const userId = request.user?.sub;
        if (!userId) {
            throw new UnauthorizedException('Пользователь не авторизован');
        }

        try {
            await this.ignoreKeywordsService.removeKeyword(+id, userId);
            return { success: true };
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException('Ошибка при удалении ключевого слова');
        }
    }

    /**
     * Заменить список игнор-слов и применить к ведомостям.
     * POST /api/mol/ignore-keywords/replace-and-apply
     */
    @Post('ignore-keywords/replace-and-apply')
    @HttpCode(HttpStatus.OK)
    async replaceAndApplyIgnoreKeywords(
        @Req() request: RequestWithUser,
        @Body() body: { keywords: string[] }
    ) {
        const userId = request.user?.sub;
        if (!userId) {
            throw new UnauthorizedException('Пользователь не авторизован');
        }

        if (!body.keywords || !Array.isArray(body.keywords)) {
            throw new BadRequestException('keywords должен быть массивом строк');
        }

        const updatedCount = await this.ignoreKeywordsService.replaceAndApply(
            userId,
            body.keywords
        );

        return {
            success: true,
            updatedCount,
            message: `Обновлено ${updatedCount} записей в ведомостях`
        };
    }
}