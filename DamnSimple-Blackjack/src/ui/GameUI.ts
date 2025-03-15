// ui/GameUI.ts
import { Scene } from "@babylonjs/core";
import { BlackjackGame, GameState } from "../game/BlackjackGame";
import { BettingUI } from "./BettingUI";
import { GameActionUI } from "./GameActionUI";
import { StatusUI } from "./StatusUI";
import { NavigationUI } from "./NavigationUI";

export class GameUI {
    private scene: Scene;
    private game: BlackjackGame;
    private bettingUI: BettingUI;
    private gameActionUI: GameActionUI;
    private statusUI: StatusUI;
    private navigationUI: NavigationUI;
    private onOpenSettings: () => void;
    private onClearTable: () => void;
    private currencySign: string = "$";

    constructor(
        scene: Scene, 
        game: BlackjackGame, 
        onOpenSettings: () => void,
        onClearTable: () => void
    ) {
        this.scene = scene;
        this.game = game;
        this.onOpenSettings = onOpenSettings;
        this.onClearTable = onClearTable;
        
        // Create UI components
        this.statusUI = new StatusUI(scene, game);
        
        this.bettingUI = new BettingUI(scene, game, (bet) => {
            this.confirmBet(bet);
        });
        
        this.gameActionUI = new GameActionUI(scene, game, () => {
            this.update();
        });
        
        this.navigationUI = new NavigationUI(
            scene, 
            game, 
            () => this.onSitDown(),
            () => this.onLeaveTable(),
            () => this.onNewGame(),
            onOpenSettings
        );
        
        // Initial update
        this.update();
    }
    
    private onSitDown(): void {
        // Show betting UI when player sits down
        this.bettingUI.show();
        this.game.setGameState(GameState.Betting);
        this.update();
    }
    
    private confirmBet(bet: number): void {
        // Start the game with current bet
        this.game.startNewGame(bet);
        this.update();
    }
    
    private onLeaveTable(): void {
        // Only allow leaving at appropriate times
        if (this.game.getGameState() === GameState.Betting || 
            this.game.getGameState() === GameState.GameOver) {
            
            // Reset to initial state
            this.game.setGameState(GameState.Initial);
            this.onClearTable();
            this.update();
        }
    }
    
    private onNewGame(): void {
        // Show betting UI for a new game
        this.bettingUI.show();
        this.game.setGameState(GameState.Betting);
        this.update();
    }

    public update(): void {
        // Update all UI components
        this.statusUI.update();
        this.bettingUI.update();
        this.gameActionUI.update();
        this.navigationUI.update();
    }
    
    public setCurrencySign(sign: string): void {
        this.currencySign = sign;
        this.statusUI.setCurrencySign(sign);
        this.bettingUI.setCurrencySign(sign);
    }
}
