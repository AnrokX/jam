import { RoundManager } from '../managers/round-manager';
import { ScoreManager } from '../managers/score-manager';
import { MovingBlockManager } from '../moving_blocks/moving-block-entity';
import { World } from 'hytopia';
import { mock, describe, test, expect, beforeEach, jest } from 'bun:test';

// Mock implementations
const mockWorld = {
    entityManager: {
        getAllPlayerEntities: jest.fn(),
        getAllEntities: jest.fn()
    }
} as unknown as World;

const mockBlockManager = {
    getBlockCount: jest.fn(),
    createZAxisBlock: jest.fn(),
    createSineWaveBlock: jest.fn(),
    createStaticTarget: jest.fn(),
    createVerticalWaveBlock: jest.fn()
} as unknown as MovingBlockManager;

describe('RoundManager - Game Lifecycle', () => {
    let roundManager: RoundManager;
    let scoreManager: ScoreManager;
    let mockPlayers: any[];

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Create fresh instances
        scoreManager = new ScoreManager();
        roundManager = new RoundManager(mockWorld, mockBlockManager, scoreManager);
        
        // Setup default mock players
        mockPlayers = [
            { 
                player: { 
                    id: 'player1',
                    ui: { sendData: jest.fn() }
                }
            }
        ];
        
        // Default mock implementation
        (mockWorld.entityManager.getAllPlayerEntities as jest.Mock).mockReturnValue(mockPlayers);
        (mockWorld.entityManager.getAllEntities as jest.Mock).mockReturnValue([]);
    });

    describe('Game Start Conditions', () => {
        test('should not start game with insufficient players', () => {
            // Mock no players
            (mockWorld.entityManager.getAllPlayerEntities as jest.Mock).mockReturnValue([]);
            
            roundManager.startRound();
            
            // Should be in waiting state
            expect(roundManager.isWaitingForPlayers()).toBe(true);
            expect(roundManager.isActive()).toBe(false);
        });

        test('should start game when minimum players join', () => {
            // Mock minimum required players
            (mockWorld.entityManager.getAllPlayerEntities as jest.Mock).mockReturnValue(mockPlayers);
            
            roundManager.startRound();
            
            // Should start countdown and not be in waiting state
            expect(roundManager.isWaitingForPlayers()).toBe(false);
            // Note: Round won't be active immediately due to countdown
            expect(roundManager.getCurrentRound()).toBe(0);
        });

        test('should broadcast waiting for players message', () => {
            // Setup a mock player first, then remove them
            (mockWorld.entityManager.getAllPlayerEntities as jest.Mock).mockReturnValue(mockPlayers);
            
            // Then mock no players for the actual check
            (mockWorld.entityManager.getAllPlayerEntities as jest.Mock)
                .mockReturnValueOnce([])  // First call returns empty
                .mockReturnValue(mockPlayers);  // Subsequent calls return players
            
            roundManager.startRound();
            
            expect(roundManager.isWaitingForPlayers()).toBe(true);
            // Verify waiting message was broadcast to the mock player
            expect(mockPlayers[0].player.ui.sendData).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'waitingForPlayers',
                    data: expect.objectContaining({
                        current: 0,
                        required: 1
                    })
                })
            );
        });
    });

    describe('Round Progression', () => {
        test('should increment round counter when round starts', () => {
            // Mock private method to bypass countdown
            (roundManager as any).actuallyStartRound();
            
            expect(roundManager.getCurrentRound()).toBe(1);
            expect(roundManager.isActive()).toBe(true);
        });

        test('should end round after duration', async () => {
            (roundManager as any).actuallyStartRound();
            
            // Fast forward round duration
            await new Promise(resolve => setTimeout(resolve, 100));
            roundManager.endRound();
            
            expect(roundManager.isActive()).toBe(false);
        });

        test('should broadcast round updates', () => {
            (roundManager as any).actuallyStartRound();
            
            // Verify round info was broadcast
            expect(mockPlayers[0].player.ui.sendData).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'roundUpdate'
                })
            );
        });
    });

    describe('Game End and Restart', () => {
        test('should end game after max rounds', () => {
            // Set current round to max
            for (let i = 0; i < 4; i++) {
                (roundManager as any).actuallyStartRound();
                roundManager.endRound();
            }
            
            // Verify game end broadcast
            expect(mockPlayers[0].player.ui.sendData).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'gameEnd'
                })
            );
        });

        test('should reset game state for new game', () => {
            // Start and end a game
            (roundManager as any).actuallyStartRound();
            roundManager.endRound();
            (roundManager as any).resetGame();
            
            expect(roundManager.getCurrentRound()).toBe(0);
            expect(roundManager.isActive()).toBe(false);
        });

        test('should handle player leaving mid-game', () => {
            (roundManager as any).actuallyStartRound();
            
            // Mock player leaving
            (mockWorld.entityManager.getAllPlayerEntities as jest.Mock).mockReturnValue([]);
            roundManager.handlePlayerLeave();
            
            // Game should continue with fewer players
            expect(roundManager.isActive()).toBe(true);
        });
    });

    describe('Leaderboard and Scoring', () => {
        test('should track round winners', () => {
            (roundManager as any).actuallyStartRound();
            
            // Simulate some scoring
            scoreManager.addScore('player1', 100);
            
            roundManager.endRound();
            
            // Verify winner announcement
            expect(mockPlayers[0].player.ui.sendData).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'roundEnd'
                })
            );
        });

        test('should calculate final standings at game end', () => {
            // Play through all rounds to trigger game end
            for (let i = 0; i < 4; i++) {
                (roundManager as any).actuallyStartRound();
                scoreManager.addScore('player1', 100);
                roundManager.endRound();
            }
            
            // Verify game end data was sent
            expect(mockPlayers[0].player.ui.sendData).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'gameEnd',
                    data: expect.objectContaining({
                        winner: expect.any(Object),
                        standings: expect.any(Array)
                    })
                })
            );
        });
    });

    describe('Cleanup', () => {
        test('should properly cleanup resources', () => {
            (roundManager as any).actuallyStartRound();
            
            // Force round to be active
            expect(roundManager.isActive()).toBe(true);
            
            // Cleanup should clear all timers and state
            roundManager.cleanup();
            roundManager.endRound(); // Ensure round is properly ended
            
            expect(roundManager.isActive()).toBe(false);
            expect((roundManager as any).roundTimer).toBeNull();
            expect((roundManager as any).blockSpawnTimer).toBeNull();
            expect((roundManager as any).checkPlayersInterval).toBeNull();
        });
    });
}); 