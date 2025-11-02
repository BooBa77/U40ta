// Импортируем необходимые модули для тестирования из NestJS
import { Test, TestingModule } from '@nestjs/testing';
import { TelegramUsersController } from './telegram-users.controller';

// describe - функция из Jest, которая группирует связанные тесты
// 'TelegramUsersController' - название тестовой группы, которое будет отображаться в отчете
describe('TelegramUsersController', () => {
  // Объявляем переменную для хранения экземпляра контроллера, который будем тестировать
  let controller: TelegramUsersController;

  // beforeEach - функция, которая выполняется ПЕРЕД каждым тестом в этой группе
  // Здесь мы настраиваем тестовое окружение
  beforeEach(async () => {
    // Test.createTestingModule() - создает тестовый модуль, аналогичный обычному NestJS модулю
    // но с возможностью мокать (заглушать) зависимости
    const module: TestingModule = await Test.createTestingModule({
      // В тестовом модуле указываем только то, что нужно для тестирования контроллера
      // В данном случае - только сам контроллер
      controllers: [TelegramUsersController],
    }).compile(); // compile() - компилирует модуль, создавая экземпляры классов

    // module.get() - получает экземпляр контроллера из скомпилированного модуля
    // TypeScript автоматически определяет тип благодаря дженерику <TelegramUsersController>
    controller = module.get<TelegramUsersController>(TelegramUsersController);
  });

  // it - отдельный тест-кейс
  // 'should be defined' - описание того, что должен делать тест
  it('should be defined', () => {
    // expect - функция утверждения (assertion) из Jest
    // toBeDefined() - проверяет, что значение не является undefined или null
    // Этот тест проверяет, что контроллер был успешно создан и инициализирован
    expect(controller).toBeDefined();
  });
});