// scenes/GameScene.ts
import { Scene, Engine } from "@babylonjs/core";
import { BlackjackGame } from "../game/BlackjackGame";
import { GameUI } from "../ui/GameUI";
import { TableEnvironment } from "./components/TableEnvironment";
import { CardVisualizer } from "./components/CardVisualizer";
import { GameController } from "./components/GameController";

export class GameScene {
    private scene: Scene;
    private blackjackGame: BlackjackGame;
    private gameUI: GameUI;
    private tableEnvironment: TableEnvironment;
    private cardVisualizer: CardVisualizer;
    private gameController: GameController;

    /**
     * Initializes a new instance of the GameScene class.
     * 
     * @param {Engine} engine - The Babylon.js engine used to render the scene.
     * @param {HTMLCanvasElement} canvas - The canvas element on which the scene is rendered.
     * @param {() => void} onOpenSettings - Callback function to open the settings menu.
     * 
     * This constructor sets up the game environment, including the scene, game model,
     * table environment, card visualizer, UI, and game controller. It binds necessary
     * callbacks and updates the UI to reflect the current game state.
     */
    constructor(engine: Engine, canvas: HTMLCanvasElement, onOpenSettings: () => void) {
        console.log("GameScene constructor called");
        
        // Create the scene
        this.scene = new Scene(engine);
        
        // Create the game model
        this.blackjackGame = new BlackjackGame();
        
        // Create the table environment (camera, lights, table)
        this.tableEnvironment = new TableEnvironment(this.scene);
        
        // Create the card visualizer
        this.cardVisualizer = new CardVisualizer(
            this.scene,
            this.blackjackGame,
            this.tableEnvironment.getDeckPosition(),
            this.onAnimationComplete.bind(this)
        );
        
        // Create the UI
        this.gameUI = new GameUI(
            this.scene, 
            this.blackjackGame, 
            onOpenSettings,
            this.clearTable.bind(this)
        );
        
        // Create the game controller
        this.gameController = new GameController(
            this.scene,
            this.blackjackGame,
            this.gameUI,
            this.cardVisualizer
        );
        
        // Update the UI to reflect the current game state
        this.gameController.update();
    }

    /**
     * Callback function triggered when an animation completes.
     * It delegates the event to the GameController to handle
     * any post-animation logic, such as updating the game state
     * or initiating the next action.
     */
    private onAnimationComplete(): void {
        this.gameController.onAnimationComplete();
    }
    
    /**
     * Clears the game table by delegating the action to the GameController.
     * This involves disposing of all card visualizations and resetting the table
     * to its initial state.
     */
    public clearTable(): void {
        this.gameController.clearTable();
    }

    /**
     * Updates the game state and UI.
     * This method should be called in the render loop to ensure
     * that the game state is updated and the UI reflects the current
     * state of the game.
     */
    public update(): void {
        this.gameController.update();
    }

    
    /**
     * Retrieves the GameUI instance associated with the game scene.
     * The GameUI is responsible for rendering all of the UI elements
     * for the game, including the game actions, navigation, and status
     * text blocks.
     * 
     * @returns {GameUI} The GameUI associated with the game scene.
     */
    public getGameUI(): GameUI {
        return this.gameUI;
    }

    /**
     * Retrieves the current Babylon.js scene instance associated with the game scene.
     * @returns {Scene} The scene associated with the game scene.
     */
    public getScene(): Scene {
        return this.scene;
    }

    /**
     * Retrieves the BlackjackGame instance associated with the game scene.
     * The BlackjackGame instance is the core game logic class that manages the
     * game state and game flow. It encapsulates the game's state, including the
     * player's hand, dealer's hand, game result, player's funds, and current bet.
     * 
     * @returns {BlackjackGame} The BlackjackGame instance associated with the game scene.
     */
    public getBlackjackGame(): BlackjackGame {
        return this.blackjackGame;
    }
}
