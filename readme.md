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

```mermaid
graph TD
    subgraph "User"
        Player([<fa:fa-user> Player])
    end

    subgraph "Browser View"
        style UI fill:#f9f,stroke:#333,stroke-width:2px
        style 3DScene fill:#ccf,stroke:#333,stroke-width:2px
        UI("<b>Game UI</b><br/><i>Babylon.js GUI<br/>(Buttons, Scores, Status)</i>")
        3DScene("<b>3D Visuals</b><br/><i>Babylon.js Scene<br/>(Cards, Table, Animations)</i>")
    end

    subgraph "Application Logic"
        style Controller fill:#9f9,stroke:#333,stroke-width:2px
        style Model fill:#fcf,stroke:#333,stroke-width:2px
        Controller("<b>GameController</b><br/><i>Mediator between<br/>Model and View</i>")
        Model("<b>BlackjackGame (Model)</b><br/><i>Core Rules, State, Deck, Funds</i>")
    end

    subgraph "Persistence"
        style Storage fill:#f96,stroke:#333,stroke-width:2px
        Storage("<b>GameStorage</b><br/><i>Browser localStorage</i>")
    end

    %% --- High-Level Flow for a Player Action (e.g., "Hit") ---
    Player -- "1. Clicks 'Hit' button" --> UI
    UI -- "2. Calls game.playerHit()" --> Model
    Model -- "3. Processes logic<br/>(draws card, checks state)" --> Model
    Model -- "4. Notifies Controller of new card" --> Controller
    Controller -- "5. Tells 3D Scene to animate card" --> 3DScene
    3DScene -- "6. Animation finishes, notifies Controller" --> Controller
    Controller -- "7. Notifies Model of animation completion" --> Model
    Model -- "8. Finishes logic<br/>(e.g., checks for bust)" --> Model
    Model -- "9. Notifies Controller of final state change" --> Controller
    Controller -- "10. Updates all UI components" --> UI
    UI -- "11. Displays new score & status" --> Player

    %% --- Storage Interaction ---
    Model -.->|Saves/Loads State| Storage
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