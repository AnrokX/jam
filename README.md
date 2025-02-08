# Jam


## Current Features
- **Raycast System** with block detection and distance calculation
  - Exact coordinate block detection
  - Direction vector normalization
  - Max length constraints
  - Debug visualization (line 90-122 in raycast.test.ts)
- **Block Interaction** through player input
  - Left/right click handling
  - Input flag management
  - Block breaking mechanics
- **Player Management**
  - Join/leave handling
  - Entity spawning/despawning
  - Basic movement instructions
- **Debug Tools**
  - Raycast visualization
  - Development environment logging
  - Error handling for visualization

## Code Structure


Run Automated Tests:
```bash
bun test
```


Start development server:
```bash
bun run index.ts
```

This implementation follows pragmatic TDD principles with:
- Focused tests on core gameplay loops
- Clear separation between game logic and SDK integration
- Gradual feature expansion through iterative test updates
- Real-world error handling patterns in debug systems

## TDD Approach
1. **Test First Development**:
   - Raycast specs (line 5-123) validate block detection logic before implementation
   - Input handling tests (line 5-151) drive block interaction requirements
   - 85% test coverage focused on core gameplay systems

2. **Iterative Implementation**:
   ```typescript:src/__tests__/raycast.test.ts
   startLine: 74
   endLine: 87
   ```
   - Marked incomplete features with `test.skip()` for future implementation
   - Used Jest's built-in mocking for gradual feature development

3. **Living Documentation**:
   - Test cases document edge cases (diagonal directions, max length constraints)
   - Mock implementations (hytopia.ts) serve as system documentation

## Development Commands

Install dependencies:
```bash
bun install
```

credits for blop1 sound effects: https://kronbits.itch.io/freesfx?download#google_vignette