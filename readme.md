# Damn Simple Blackjack

**A modern, 3D Blackjack game built with TypeScript and Babylon.js.**


*(Screenshot placeholder)*

This project is a fully-featured Blackjack game rendered in a 3D environment. It demonstrates a clean separation between core game logic and visual presentation, using Babylon.js for rendering and UI, and pure TypeScript for the game rules and state management.

---

## ✨ Features

*   **Full 3D Gameplay**: Experience Blackjack on a 3D table with animated card dealing, flipping, and repositioning.
*   **Responsive UI**: The user interface, built with Babylon.js GUI, adapts to different screen sizes.
*   **Complete Game Loop**: Implements standard Blackjack rules including Hit, Stand, Double Down, Push, and 3:2 Blackjack payouts.
*   **Persistent State**: Your funds and current game progress are automatically saved to local storage, so you can pick up where you left off.
*   **In-Game Settings**: Adjust graphics quality and UI scale on the fly.
*   **Powerful Debug Console**: A comprehensive debug manager is available in the browser console for easy testing and state manipulation.

## 🚀 Live Demo

**[Play the game live here!](https://your-deployment-url.com)** *(deployment link)*

---

## ⚙️ Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

You need to have [Node.js](https://nodejs.org/) (which includes npm) installed on your system.

### Installation & Running

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/your-username/damn-simple-blackjack.git
    cd damn-simple-blackjack
    ```

2.  **Install dependencies:**
    ```sh
    npm install
    ```

3.  **Run the development server:**
    This command will start a local server and open the game in your default browser. It supports hot-reloading.
    ```sh
    npm run dev
    ```

4.  **Build for production:**
    This command bundles the application into the `dist` directory for deployment.
    ```sh
    npm run build
    ```

---

## 🏗️ Architecture and Design

The project follows a decoupled architecture that separates core logic from the view layer, loosely based on the Model-View-Controller (MVC) pattern.

*   **Game Logic (Model)**: The `src/game` directory contains pure TypeScript classes that manage the game's state, rules, deck, and player funds. This part of the code has no dependency on Babylon.js and could be run in a non-visual environment (like a server or a terminal).
*   **Scene & Visuals (View)**: The `src/scenes` and `src/ui` directories contain all the visual components. `CardVisualizer` and `TableEnvironment` handle the 3D objects, while the UI classes handle the 2D GUI.
*   **GameController (Controller)**: The `GameController` class acts as a **mediator** between the game logic and the visual components. It listens for events from both sides and orchestrates the flow of data, ensuring that the view is always a reflection of the model's state.

### UML Class Diagram

This diagram illustrates the relationships between the major components of the application.

```plantuml
@startuml Blackjack Game UML

!theme spacelab
skinparam packageStyle rectangle
skinparam classAttributeIconSize 0
hide empty members

' --- Enums ---
package "Enums" <<Frame>> {
    enum Suit { Hearts, Diamonds, Clubs, Spades }
    enum Rank { Two, ..., King, Ace }
    enum GameState { Initial, Betting, PlayerTurn, DealerTurn, GameOver }
    enum GameResult { PlayerWins, DealerWins, Push, PlayerBlackjack, InProgress }
}

' --- Game Logic Core ---
package "Game Logic" <<Node>> {
    class Card {
        - suit: Suit
        - rank: Rank
        - faceUp: boolean
        + onFlip: (card: Card) => void
        + flip(): void
        + getValue(): number
    }
    Card o-- Suit
    Card o-- Rank

    class Deck {
        - cards: Card[]
        + drawCard(): Card
    }
    Deck "1" *-- "52..*" Card : creates

    class ScoreCalculator <<utility>> {
        {static} + calculateHandValue(hand: Card[]): number
    }
    ScoreCalculator ..> Card

    class HandManager {
        + drawCard(): Card
        + registerFlipCallback(card: Card): void
    }
    HandManager "1" *-- "1" Deck

    class PlayerFunds {
        + getFunds(): number
        + addFunds(amount): void
        + deductFunds(amount): boolean
    }

    class GameStorage <<utility>> {
        {static} + saveGameState(...)
        {static} + loadGameState(): LoadedGameState
    }
    PlayerFunds ..> GameStorage

    class GameActions {
        - gameState: GameState
        + setGameState(state): void
        + startNewGame(bet): boolean
        + playerHit(): void
        + playerStand(): void
        + onAnimationComplete(): void
    }
    GameActions o-- GameState
    GameActions o-- GameResult
    GameActions ..> GameStorage
    GameActions ..> ScoreCalculator

    class BlackjackGame {
        - playerHand: Card[]
        - dealerHand: Card[]
        + notifyCardDealt: (card, ...) => void
        + setAnimationCompleteCallback(callback): void
        + startNewGame(bet): boolean
        + getGameState(): GameState
        + getPlayerHand(): Card[]
        + getDealerHand(): Card[]
    }
    BlackjackGame o-- "0..*" Card : has
    BlackjackGame "1" *-- "1" GameActions
    BlackjackGame "1" *-- "1" HandManager
    BlackjackGame "1" *-- "1" PlayerFunds
    BlackjackGame ..> ScoreCalculator
    GameActions ..> BlackjackGame : modifies >
}


' --- UI Layer ---
package "UI" <<Cloud>> {
    abstract class BaseUI {
        # guiTexture: AdvancedDynamicTexture
        + {abstract} update(...): void
        + applyUIScale(scaleFactor): void
    }

    class GameUI {
        + update(isAnimating): void
    }
    GameUI -up-|> BaseUI

    class BettingUI {
        + update(): void
    }
    BettingUI -up-|> BaseUI

    class GameActionUI {
        + update(isAnimating): void
    }
    GameActionUI -up-|> BaseUI

    class StatusUI {
        + update(): void
    }
    StatusUI -up-|> BaseUI

    class NavigationUI {
        + update(): void
    }
    NavigationUI -up-|> BaseUI

    GameUI "1" *-- "1" BettingUI
    GameUI "1" *-- "1" GameActionUI
    GameUI "1" *-- "1" StatusUI
    GameUI "1" *-- "1" NavigationUI

    ' UI dependencies on game logic
    BettingUI ..> BlackjackGame
    GameActionUI ..> BlackjackGame
    StatusUI ..> BlackjackGame
    NavigationUI ..> BlackjackGame
}

' --- Scene and Visuals ---
package "Scene & Visuals" <<Database>> {
    class GameScene {
        + applyGraphicsQualitySetting(level): void
        + applyUIScaleSetting(level): void
    }

    class GameController {
        - onVisualAnimationComplete(): void
        - onGameActionComplete(): void
        - requestCardDealAnimation(...): void
        + update(): void
    }

    class CardVisualizer {
        - cardMeshes: Map<string, Mesh>
        + createCardMesh(card, ...): void
        + renderCards(): void
        + clearTable(): void
        + isAnimationInProgress(): boolean
    }
    CardVisualizer ..> Card : reads state
    CardVisualizer ..> BlackjackGame : reads hands

    class TableEnvironment {
        + createTable(): Mesh
    }
}

' --- Debugging ---
package "Debug" {
    class DebugManager {
        + help(): void
        + setGameState(state): void
        + addCard(...): void
    }
}

' --- Main Application ---
package "Application" {
    class Game {
        - currentSceneInstance: Scene
        - switchScene(type): void
    }
    class MainMenuScene {}
    class SettingsScene {}

    Game "1" o-- "1" GameScene : manages >
    Game "1" o-- "1" SettingsScene : manages >
    Game "1" o-- "1" MainMenuScene : manages >
}


' --- Relationships between packages ---

GameScene "1" *-- "1" BlackjackGame
GameScene "1" *-- "1" GameUI
GameScene "1" *-- "1" GameController
GameScene "1" *-- "1" CardVisualizer
GameScene "1" *-- "1" TableEnvironment
GameScene "1" *-- "1" DebugManager

' Controller Mediation
GameController ..> BlackjackGame : "triggers actions"
GameController ..> GameUI : "updates UI state"
GameController ..> CardVisualizer : "requests visuals"

BlackjackGame ..> GameController : "notifies action complete"
CardVisualizer ..> GameController : "notifies animation complete"
GameUI ..> GameController : "forwards user input"

note "The GameController acts as a mediator between the game logic (Model), the UI (View), and the 3D visuals (View)." as N1
GameController .. N1

TableEnvironment ..> CardVisualizer : "uses for materials"

DebugManager ..> GameScene
DebugManager ..> BlackjackGame
DebugManager ..> CardVisualizer
DebugManager ..> GameUI

@enduml
```

---

## 🐛 In-Game Debugger

For development and testing, a powerful debug manager is exposed to the browser's developer console.

1.  Open your browser's developer tools (usually `F12` or `Ctrl+Shift+I`).
2.  Switch to the "Console" tab.
3.  The `debug` object is available on the `window` scope. Type `debug.help()` to see a full list of available commands.

### Example Commands

```js
// Get a list of all available commands
debug.help();

// Get a detailed snapshot of the current game state
debug.getState();

// Give yourself more money
debug.setFunds(5000);

// Force the game into the player's turn
debug.setGameState(2); // 2 = PlayerTurn

// Add a specific card to your hand
debug.addCard(true, 'Spades', 'A', true); // (isPlayer, suit, rank, faceUp)

// Deal a random card to the dealer, face down
debug.dealRandomCard(false, false);
```

---

## 🤝 Contributing

Contributions are welcome! If you have a suggestion or want to fix a bug, please feel free to fork the repository and submit a pull request.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---

## 📜 License

This project is licensed under the MIT License - see the `LICENSE` file for details.