import pygame
import random

pygame.init()

# 颜色定义
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
GRAY = (128, 128, 128)
DARK_GRAY = (40, 40, 40)

# 方块颜色
COLORS = [
    (0, 255, 255),    # I - 青色
    (0, 0, 255),      # J - 蓝色
    (255, 165, 0),    # L - 橙色
    (255, 255, 0),    # O - 黄色
    (0, 255, 0),      # S - 绿色
    (128, 0, 128),    # T - 紫色
    (255, 0, 0),      # Z - 红色
]

# 方块形状定义
SHAPES = [
    [[1, 1, 1, 1]],                           # I
    [[1, 0, 0], [1, 1, 1]],                   # J
    [[0, 0, 1], [1, 1, 1]],                   # L
    [[1, 1], [1, 1]],                         # O
    [[0, 1, 1], [1, 1, 0]],                   # S
    [[0, 1, 0], [1, 1, 1]],                   # T
    [[1, 1, 0], [0, 1, 1]],                   # Z
]

BLOCK_SIZE = 30
GRID_WIDTH = 10
GRID_HEIGHT = 20
GRID_OFFSET_X = 50
GRID_OFFSET_Y = 50

SIDEBAR_WIDTH = 200
SCREEN_WIDTH = GRID_OFFSET_X * 2 + GRID_WIDTH * BLOCK_SIZE + SIDEBAR_WIDTH
SCREEN_HEIGHT = GRID_OFFSET_Y * 2 + GRID_HEIGHT * BLOCK_SIZE

screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption("俄罗斯方块")
clock = pygame.time.Clock()
font = pygame.font.Font(None, 36)
small_font = pygame.font.Font(None, 28)


class Piece:
    def __init__(self, shape_idx):
        self.shape_idx = shape_idx
        self.shape = SHAPES[shape_idx]
        self.color = COLORS[shape_idx]
        self.x = GRID_WIDTH // 2 - len(self.shape[0]) // 2
        self.y = 0

    def rotate(self):
        # 转置并反转行 = 顺时针旋转90度
        self.shape = [list(row) for row in zip(*self.shape[::-1])]

    def get_cells(self):
        cells = []
        for y, row in enumerate(self.shape):
            for x, cell in enumerate(row):
                if cell:
                    cells.append((self.x + x, self.y + y))
        return cells


class TetrisGame:
    def __init__(self):
        self.reset()

    def reset(self):
        self.grid = [[BLACK for _ in range(GRID_WIDTH)] for _ in range(GRID_HEIGHT)]
        self.current_piece = self.new_piece()
        self.next_piece = self.new_piece()
        self.score = 0
        self.lines = 0
        self.level = 1
        self.game_over = False
        self.paused = False
        self.fall_time = 0
        self.fall_speed = 1000  # 初始下落间隔(ms)

    def new_piece(self):
        return Piece(random.randint(0, len(SHAPES) - 1))

    def valid_position(self, piece, dx=0, dy=0, rotated_shape=None):
        shape = rotated_shape if rotated_shape else piece.shape
        for y, row in enumerate(shape):
            for x, cell in enumerate(row):
                if cell:
                    nx = piece.x + x + dx
                    ny = piece.y + y + dy
                    if nx < 0 or nx >= GRID_WIDTH or ny >= GRID_HEIGHT:
                        return False
                    if ny >= 0 and self.grid[ny][nx] != BLACK:
                        return False
        return True

    def lock_piece(self, piece):
        for y, row in enumerate(piece.shape):
            for x, cell in enumerate(row):
                if cell:
                    gy = piece.y + y
                    gx = piece.x + x
                    if gy >= 0:
                        self.grid[gy][gx] = piece.color
        self.clear_lines()
        self.current_piece = self.next_piece
        self.next_piece = self.new_piece()
        if not self.valid_position(self.current_piece):
            self.game_over = True

    def clear_lines(self):
        lines_cleared = 0
        y = GRID_HEIGHT - 1
        while y >= 0:
            if all(cell != BLACK for cell in self.grid[y]):
                del self.grid[y]
                self.grid.insert(0, [BLACK for _ in range(GRID_WIDTH)])
                lines_cleared += 1
            else:
                y -= 1

        if lines_cleared > 0:
            self.lines += lines_cleared
            self.score += lines_cleared * 100 * self.level
            if lines_cleared >= 4:
                self.score += 400 * self.level  # 四行奖励
            self.level = self.lines // 10 + 1
            self.fall_speed = max(100, 1000 - (self.level - 1) * 100)

    def hard_drop(self):
        while self.valid_position(self.current_piece, dy=1):
            self.current_piece.y += 1
        self.lock_piece(self.current_piece)

    def update(self, dt):
        if self.game_over or self.paused:
            return

        self.fall_time += dt
        if self.fall_time >= self.fall_speed:
            self.fall_time = 0
            if self.valid_position(self.current_piece, dy=1):
                self.current_piece.y += 1
            else:
                self.lock_piece(self.current_piece)

    def draw(self):
        screen.fill(BLACK)

        # 绘制网格边框
        pygame.draw.rect(screen, GRAY, (
            GRID_OFFSET_X - 2, GRID_OFFSET_Y - 2,
            GRID_WIDTH * BLOCK_SIZE + 4, GRID_HEIGHT * BLOCK_SIZE + 4
        ), 2)

        # 绘制网格背景
        for y in range(GRID_HEIGHT):
            for x in range(GRID_WIDTH):
                rect = pygame.Rect(
                    GRID_OFFSET_X + x * BLOCK_SIZE,
                    GRID_OFFSET_Y + y * BLOCK_SIZE,
                    BLOCK_SIZE - 1, BLOCK_SIZE - 1
                )
                pygame.draw.rect(screen, DARK_GRAY, rect)
                if self.grid[y][x] != BLACK:
                    self.draw_block(x, y, self.grid[y][x])

        # 绘制当前方块
        if not self.game_over:
            for y, row in enumerate(self.current_piece.shape):
                for x, cell in enumerate(row):
                    if cell:
                        self.draw_block(
                            self.current_piece.x + x,
                            self.current_piece.y + y,
                            self.current_piece.color
                        )

            # 绘制幽灵方块（预览落点）
            ghost_y = self.current_piece.y
            while self.valid_position(self.current_piece, dy=ghost_y - self.current_piece.y + 1):
                ghost_y += 1
            for y, row in enumerate(self.current_piece.shape):
                for x, cell in enumerate(row):
                    if cell:
                        rect = pygame.Rect(
                            GRID_OFFSET_X + (self.current_piece.x + x) * BLOCK_SIZE,
                            GRID_OFFSET_Y + (ghost_y + y) * BLOCK_SIZE,
                            BLOCK_SIZE - 1, BLOCK_SIZE - 1
                        )
                        pygame.draw.rect(screen, (
                            self.current_piece.color[0] // 4,
                            self.current_piece.color[1] // 4,
                            self.current_piece.color[2] // 4
                        ), rect)

        # 绘制侧边栏
        sidebar_x = GRID_OFFSET_X + GRID_WIDTH * BLOCK_SIZE + 30

        # 标题
        title = font.render("俄罗斯方块", True, WHITE)
        screen.blit(title, (sidebar_x, GRID_OFFSET_Y))

        # 分数
        score_text = small_font.render(f"分数: {self.score}", True, WHITE)
        screen.blit(score_text, (sidebar_x, GRID_OFFSET_Y + 50))

        level_text = small_font.render(f"等级: {self.level}", True, WHITE)
        screen.blit(level_text, (sidebar_x, GRID_OFFSET_Y + 80))

        lines_text = small_font.render(f"行数: {self.lines}", True, WHITE)
        screen.blit(lines_text, (sidebar_x, GRID_OFFSET_Y + 110))

        # 下一个方块
        next_text = small_font.render("下一个:", True, WHITE)
        screen.blit(next_text, (sidebar_x, GRID_OFFSET_Y + 160))

        next_x = sidebar_x + 20
        next_y = GRID_OFFSET_Y + 200
        for y, row in enumerate(self.next_piece.shape):
            for x, cell in enumerate(row):
                if cell:
                    rect = pygame.Rect(
                        next_x + x * BLOCK_SIZE,
                        next_y + y * BLOCK_SIZE,
                        BLOCK_SIZE - 1, BLOCK_SIZE - 1
                    )
                    pygame.draw.rect(screen, self.next_piece.color, rect)

        # 操作说明
        controls = [
            "操作说明:",
            "← → 左右移动",
            "↑ 旋转",
            "↓ 加速下落",
            "空格 直接落下",
            "P 暂停",
            "R 重新开始",
        ]
        for i, text in enumerate(controls):
            color = GRAY if i == 0 else WHITE
            ctrl_text = small_font.render(text, True, color)
            screen.blit(ctrl_text, (sidebar_x, GRID_OFFSET_Y + 350 + i * 28))

        # 游戏结束
        if self.game_over:
            overlay = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT))
            overlay.set_alpha(180)
            overlay.fill(BLACK)
            screen.blit(overlay, (0, 0))

            over_text = font.render("游戏结束!", True, (255, 0, 0))
            text_rect = over_text.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 - 30))
            screen.blit(over_text, text_rect)

            restart_text = small_font.render("按 R 重新开始", True, WHITE)
            restart_rect = restart_text.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 + 20))
            screen.blit(restart_text, restart_rect)

        # 暂停
        elif self.paused:
            overlay = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT))
            overlay.set_alpha(180)
            overlay.fill(BLACK)
            screen.blit(overlay, (0, 0))

            pause_text = font.render("已暂停", True, WHITE)
            text_rect = pause_text.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2))
            screen.blit(pause_text, text_rect)

        pygame.display.flip()

    def draw_block(self, x, y, color):
        rect = pygame.Rect(
            GRID_OFFSET_X + x * BLOCK_SIZE,
            GRID_OFFSET_Y + y * BLOCK_SIZE,
            BLOCK_SIZE - 1, BLOCK_SIZE - 1
        )
        pygame.draw.rect(screen, color, rect)
        # 高光效果
        highlight = pygame.Rect(
            GRID_OFFSET_X + x * BLOCK_SIZE + 2,
            GRID_OFFSET_Y + y * BLOCK_SIZE + 2,
            BLOCK_SIZE // 3, BLOCK_SIZE // 3
        )
        lighter = tuple(min(255, c + 50) for c in color)
        pygame.draw.rect(screen, lighter, highlight)


def main():
    game = TetrisGame()
    running = True
    key_repeat_delay = 150
    last_key_time = {"left": 0, "right": 0, "down": 0}

    while running:
        dt = clock.tick(60)

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False

            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_r:
                    game.reset()
                    continue

                if event.key == pygame.K_p:
                    game.paused = not game.paused
                    continue

                if game.game_over or game.paused:
                    continue

                if event.key == pygame.K_UP:
                    original_shape = game.current_piece.shape[:]
                    game.current_piece.rotate()
                    if not game.valid_position(game.current_piece):
                        # 尝试墙踢
                        valid = False
                        for dx in [-1, 1, -2, 2]:
                            if game.valid_position(game.current_piece, dx=dx):
                                game.current_piece.x += dx
                                valid = True
                                break
                        if not valid:
                            game.current_piece.shape = original_shape

                elif event.key == pygame.K_SPACE:
                    game.hard_drop()

            # 持续按键处理
            keys = pygame.key.get_pressed()
            current_time = pygame.time.get_ticks()

            if not game.game_over and not game.paused:
                if keys[pygame.K_LEFT] and current_time - last_key_time["left"] > key_repeat_delay:
                    if game.valid_position(game.current_piece, dx=-1):
                        game.current_piece.x -= 1
                    last_key_time["left"] = current_time

                if keys[pygame.K_RIGHT] and current_time - last_key_time["right"] > key_repeat_delay:
                    if game.valid_position(game.current_piece, dx=1):
                        game.current_piece.x += 1
                    last_key_time["right"] = current_time

                if keys[pygame.K_DOWN] and current_time - last_key_time["down"] > key_repeat_delay // 2:
                    if game.valid_position(game.current_piece, dy=1):
                        game.current_piece.y += 1
                        game.score += 1
                    last_key_time["down"] = current_time

        game.update(dt)
        game.draw()

    pygame.quit()


if __name__ == "__main__":
    main()
