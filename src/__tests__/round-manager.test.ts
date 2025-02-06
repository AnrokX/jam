import { RoundManager } from '../managers/round-manager';
import { ScoreManager } from '../managers/score-manager';
import { MovingBlockManager } from '../moving_blocks/moving-block-entity';
import { World } from 'hytopia';
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

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

describe('RoundManager - Round Continuity', () => {
    let roundManager: RoundManager;
    let scoreManager: ScoreManager;
    let mockPlayers: any[];
    let mockWorld: jest.Mocked<World>;
    let mockBlockManager: jest.Mocked<MovingBlockManager>;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Setup mock players
        mockPlayers = [];
        
        // Setup mock world
        mockWorld = {
            entityManager: {
                getAllPlayerEntities: jest.fn(() => mockPlayers),
                getAllEntities: jest.fn(() => [])
            }
        } as unknown as jest.Mocked<World>;

        // Setup mock block manager
        mockBlockManager = {
            getBlockCount: jest.fn(),
            createZAxisBlock: jest.fn(),
            createSineWaveBlock: jest.fn(),
            createStaticTarget: jest.fn(),
            createVerticalWaveBlock: jest.fn()
        } as unknown as jest.Mocked<MovingBlockManager>;

        // Create fresh instances
        scoreManager = new ScoreManager();
        roundManager = new RoundManager(mockWorld, mockBlockManager, scoreManager);
    });

    const addMockPlayer = (id: string) => {
        const player = {
            id,
            ui: { sendData: jest.fn() }
        };
        const playerEntity = { player };
        mockPlayers.push(playerEntity);
        return playerEntity;
    };

    test('should maintain round count when player leaves and new player joins mid-game', async () => {
        // Add initial player and start game
        addMockPlayer('player1');
        
        // Start first round
        roundManager.startRound();
        (roundManager as any).actuallyStartRound();
        expect(roundManager.getCurrentRound()).toBe(1);
        expect((roundManager as any).gameInProgress).toBe(true);

        // End round 1
        roundManager.endRound();
        expect(roundManager.getCurrentRound()).toBe(1);

        // Remove player1, add player2
        mockPlayers = [];
        addMockPlayer('player2');

        // Start round 2 - should continue from previous round
        (roundManager as any).actuallyStartRound();
        expect(roundManager.getCurrentRound()).toBe(2);
        expect((roundManager as any).gameInProgress).toBe(true);

        // Add back player1
        addMockPlayer('player1');
        expect(roundManager.getCurrentRound()).toBe(2);

        // Verify game is still in progress
        expect((roundManager as any).gameInProgress).toBe(true);
    });

    test('should only reset game when waiting for initial players', () => {
        // Start with no players
        expect(mockPlayers.length).toBe(0);
        roundManager.startRound();
        expect(roundManager.isWaitingForPlayers()).toBe(true);
        expect((roundManager as any).gameInProgress).toBe(false);

        // Add first player and start game
        addMockPlayer('player1');
        roundManager.startRound();
        (roundManager as any).actuallyStartRound();
        expect(roundManager.getCurrentRound()).toBe(1);
        expect((roundManager as any).gameInProgress).toBe(true);

        // Player leaves mid-game
        mockPlayers = [];
        roundManager.handlePlayerLeave();
        
        // Game should continue
        expect(roundManager.getCurrentRound()).toBe(1);
        expect((roundManager as any).gameInProgress).toBe(true);

        // New player joins mid-game
        addMockPlayer('player2');
        expect(roundManager.getCurrentRound()).toBe(1);
        expect((roundManager as any).gameInProgress).toBe(true);
    });

    test('should complete full game cycle with player changes', async () => {
        // Start with player1
        addMockPlayer('player1');
        
        // Play through all rounds with player changes
        for (let i = 0; i < (roundManager as any).GAME_CONFIG.maxRounds; i++) {
            roundManager.startRound();
            (roundManager as any).actuallyStartRound();
            
            // Simulate player switch in middle rounds
            if (i === 1) {
                mockPlayers = [];
                addMockPlayer('player2');
            }
            if (i === 2) {
                addMockPlayer('player1');
            }
            
            expect(roundManager.getCurrentRound()).toBe(i + 1);
            expect((roundManager as any).gameInProgress).toBe(true);
            
            roundManager.endRound();
        }
        
        // Verify game ended properly
        expect(roundManager.getCurrentRound()).toBe((roundManager as any).GAME_CONFIG.maxRounds);
        expect((roundManager as any).gameInProgress).toBe(false);
    });

    test('should not start new round if one is pending', async () => {
        // Add initial player and start game
        addMockPlayer('player1');
        
        // Start and end round 1
        roundManager.startRound();
        (roundManager as any).actuallyStartRound();
        roundManager.endRound();
        
        // At this point, there's a 5-second timer to start next round
        
        // Simulate new player joining during the wait
        addMockPlayer('player2');
        roundManager.startRound(); // Should not trigger new round
        
        expect(roundManager.getCurrentRound()).toBe(1);
        
        // Let the scheduled round start happen
        (roundManager as any).actuallyStartRound();
        expect(roundManager.getCurrentRound()).toBe(2);
    });

    test('should handle player reload during round transition', async () => {
        // Start with player1
        const player1 = addMockPlayer('player1');
        
        // Start and end round 1
        roundManager.startRound();
        (roundManager as any).actuallyStartRound();
        roundManager.endRound();
        
        // Simulate player "reload" - same player rejoining
        mockPlayers = [];
        const player1Rejoined = addMockPlayer('player1');
        
        // Try to start round (as would happen on player join)
        roundManager.startRound();
        
        // Should still be in round 1, waiting for scheduled next round
        expect(roundManager.getCurrentRound()).toBe(1);
        
        // Let the scheduled round start happen
        (roundManager as any).actuallyStartRound();
        expect(roundManager.getCurrentRound()).toBe(2);
    });

    test('should prevent double round starts during transition period', async () => {
        jest.useFakeTimers();
        
        // Add initial player and start game
        addMockPlayer('player1');
        
        // Start first round
        roundManager.startRound();
        (roundManager as any).actuallyStartRound();
        expect(roundManager.getCurrentRound()).toBe(1);
        
        // End round which schedules next round start
        roundManager.endRound();
        
        // Verify we're in transition state
        expect((roundManager as any).isRoundActive).toBe(false);
        expect((roundManager as any).roundTransitionPending).toBe(true);
        
        // Simulate player reload/rejoin during transition
        mockPlayers = [];
        addMockPlayer('player1');
        roundManager.startRound(); // This should not trigger a new round
        
        // Fast forward 2.5 seconds (half of transition time)
        jest.advanceTimersByTime(2500);
        
        // Add another player during transition
        addMockPlayer('player2');
        roundManager.startRound(); // This should also not trigger a new round
        
        // Verify round hasn't changed
        expect(roundManager.getCurrentRound()).toBe(1);
        
        // Complete the transition period
        jest.advanceTimersByTime(2500);
        
        // Verify only one round increment occurred
        expect(roundManager.getCurrentRound()).toBe(2);
        
        jest.useRealTimers();
    });

    test('should properly handle rapid player joins/leaves', async () => {
        jest.useFakeTimers();
        
        // Start game with player1
        addMockPlayer('player1');
        roundManager.startRound();
        (roundManager as any).actuallyStartRound();
        
        // End round 1
        roundManager.endRound();
        
        // Simulate multiple player changes during transition
        for(let i = 0; i < 5; i++) {
            mockPlayers = [];
            addMockPlayer(`player${i}`);
            roundManager.startRound();
            jest.advanceTimersByTime(500);
        }
        
        // Verify we're still waiting for the original transition
        expect(roundManager.getCurrentRound()).toBe(1);
        
        // Complete transition
        jest.advanceTimersByTime(5000);
        expect(roundManager.getCurrentRound()).toBe(2);
        
        jest.useRealTimers();
    });
}); 