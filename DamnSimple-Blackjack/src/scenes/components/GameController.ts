// scenes/components/GameController.ts
import { Scene } from "@babylonjs/core";
import { BlackjackGame, GameState } from "../../game/BlackjackGame";
import { GameUI } from "../../ui/GameUI";
import { CardVisualizer } from "./CardVisualizer";

export class GameController {
    private scene: Scene;
    private blackjackGame: BlackjackGame;
    private gameUI: GameUI;
    private cardVisualizer: CardVisualizer;
    private dealerTurn: boolean = false;
    private dealerMoveTimeout: NodeJS.Timeout | null = null;
    private gameStateRestored: boolean = false;

    /**
     * Initializes a new instance of the GameController class.
     * 
     * @param {Scene} scene - The Babylon.js scene to which the game elements are added.
     * @param {BlackjackGame} blackjackGame - The game logic instance to interact with.
     * @param {GameUI} gameUI - The user interface instance for the game.
     * @param {CardVisualizer} cardVisualizer - The visualizer instance for rendering cards.
     * 
     * This constructor sets up the game controller by binding the scene, game logic,
     * UI, and card visualizer. It initiates monitoring of the game state and checks
     * if there is a need to restore a game in progress, rendering the cards and updating
     * the UI if necessary.
     */
    constructor(scene: Scene, blackjackGame: BlackjackGame, gameUI: GameUI, cardVisualizer: CardVisualizer) {
        this.scene = scene;
        this.blackjackGame = blackjackGame;
        this.gameUI = gameUI;
        this.cardVisualizer = cardVisualizer;
        
        // Setup game state monitoring
        this.setupGameStateMonitoring();

        // Check if we need to restore a game in progress
        if (this.blackjackGame.getGameState() !== GameState.Initial) {
            console.log("Restoring game in progress...");
            this.gameStateRestored = true;
            // Render the cards for the restored game
            setTimeout(() => {
                this.cardVisualizer.renderCards();
                this.gameUI.update();
            }, 500);
        }
    }

    /**
     * Sets up monitoring of the game state and card animations to manage the flow
     * of the game. This method is called once when the game controller is created.
     * It sets up an observable on the scene's onBeforeRender event to monitor
     * the game state and card animations. If the dealer's turn is active and
     * there is no animation in progress, it processes the dealer's turn by
     * calling processDealerTurn() after a 1 second delay. This method also
     * clears any existing timeout to prevent multiple calls and resets the
     * dealerTurn flag until the next move.
     */
    private setupGameStateMonitoring(): void {
        // Monitor animations and game state
        this.scene.onBeforeRenderObservable.add(() => {
            // If dealer's turn and no animation is in progress, process dealer's move
            if (this.dealerTurn && !this.cardVisualizer.isAnimationInProgress() && 
                this.blackjackGame.getGameState() === GameState.DealerTurn) {
                // Clear any existing timeout to prevent multiple calls
                if (this.dealerMoveTimeout) {
                    clearTimeout(this.dealerMoveTimeout);
                }
                
                // Set a timeout for the dealer's next move
                this.dealerMoveTimeout = setTimeout(() => {
                    this.processDealerTurn();
                }, 1000); // 1 second delay between dealer moves
                
                this.dealerTurn = false; // Reset flag until next move
            }
        });
    }

    /**
     * Processes the dealer's turn by checking if the dealer needs to hit or stand.
     * If the dealer's score is less than 17, they hit by calling the playerHit() method
     * and rendering a new card. If the dealer's score is 17 or higher, they stand and
     * the game ends by calling the playerStand() method and updating the UI.
     */
    public processDealerTurn(): void {
        console.log("Processing dealer turn");
        // Check if dealer needs to hit
        const dealerScore = this.blackjackGame.getDealerScore();
        console.log(`Dealer score: ${dealerScore}`);
        
        if (dealerScore < 17) {
            console.log("Dealer hits");
            // Dealer hits
            this.blackjackGame.playerHit(); // Use the same method as it just adds a card
            this.cardVisualizer.renderCards(); // Render the new card
            
            // Set flag to continue dealer's turn after animation completes
            this.dealerTurn = true;
        } else {
            console.log("Dealer stands");
            // Dealer stands, end the game
            this.blackjackGame.playerStand();
            this.gameUI.update();
        }
    }

    /**
     * Starts a new game with the specified bet amount, clearing the table first.
     * This method is called when the user initiates a new game, either from the
     * main menu or from the game over state. It clears the table, starts a new
     * game with the specified bet, and updates the UI and renders the cards.
     * If no bet is specified, the default bet of 10 is used.
     * 
     * @param {number} [bet=10] The amount to bet for the new game.
     */
    public startNewGame(bet: number = 10): void {
        // Clear the table first
        this.clearTable();
        
        // Start a new game with the specified bet
        this.blackjackGame.startNewGame(bet);
        
        // Update the UI and render the cards
        this.update();
    }

    /**
     * Updates the game state and UI. This method should be called in the render loop to ensure
     * that the game state is updated and the UI reflects the current state of the game.
     * If the game is in the DealerTurn state, sets a flag to process the first move of the dealer's turn.
     */
    public update(): void {
        this.cardVisualizer.renderCards();
        this.gameUI.update();
        
        // If it's dealer's turn, set the flag to process the first move
        if (this.blackjackGame.getGameState() === GameState.DealerTurn) {
            this.dealerTurn = true;
        }
    }

    /**
     * Clears the game table by disposing of all card visualizations and resetting
     * the table to its initial state. This method is called when the user starts
     * a new game or leaves the table. It delegates the action to the CardVisualizer
     * instance to clear the table.
     */
    public clearTable(): void {
        this.cardVisualizer.clearTable();
    }
    
    /**
     * Callback function triggered when an animation completes.
     * If it's the dealer's turn, sets a flag to process the next move of the dealer's turn.
     */
    public onAnimationComplete(): void {
        console.log("Animation complete");
        // If it's dealer's turn, set flag to process next move
        if (this.blackjackGame.getGameState() === GameState.DealerTurn) {
            console.log("Setting dealerTurn flag to true");
            this.dealerTurn = true;
        }
    }
}
