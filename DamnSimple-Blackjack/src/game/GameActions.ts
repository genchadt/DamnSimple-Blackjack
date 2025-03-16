// game/GameActions.ts
import { Card } from "./Card";
import { GameState, GameResult } from "./GameState";
import { HandManager } from "./HandManager";
import { PlayerFunds } from "./PlayerFunds";
import { ScoreCalculator } from "./ScoreCalculator";
import { GameStorage } from "./GameStorage";

export class GameActions {
    private handManager: HandManager;
    private playerFunds: PlayerFunds;
    private gameState: GameState = GameState.Initial;
    private gameResult: GameResult = GameResult.InProgress;
    private currentBet: number = 0;
    private lastBet: number = 10;

    constructor(handManager: HandManager, playerFunds: PlayerFunds) {
        this.handManager = handManager;
        this.playerFunds = playerFunds;
    }

    public setGameState(state: GameState): void {
        this.gameState = state;
        this.saveGameState();
    }

    public getGameState(): GameState {
        return this.gameState;
    }

    public getGameResult(): GameResult {
        return this.gameResult;
    }

    public getCurrentBet(): number {
        return this.currentBet;
    }

    public setCurrentBet(amount: number): void {
        if (amount > 0 && amount <= this.playerFunds.getFunds()) {
            this.currentBet = amount;
        }
    }

    public startNewGame(bet: number = this.lastBet): boolean {
        // Check if player has enough funds
        if (!this.playerFunds.deductFunds(bet)) {
            return false;
        }
        
        this.currentBet = bet;
        this.lastBet = bet; // Save for next game
        
        // Clear hands
        this.handManager.resetHands();
        
        // Refresh deck if needed
        this.handManager.refreshDeckIfNeeded();
        
        // Deal initial cards
        this.handManager.dealInitialCards();
        
        this.gameState = GameState.PlayerTurn;
        this.gameResult = GameResult.InProgress;
        
        // Check for blackjack
        if (ScoreCalculator.calculateHandValue(this.handManager.getPlayerHand()) === 21) {
            // Allow time for animations before we reveal cards and end game
            setTimeout(() => {
                this.handManager.revealDealerHoleCard(); // Reveal dealer's hole card
                setTimeout(() => {
                    if (ScoreCalculator.calculateHandValue(this.handManager.getDealerHand()) === 21) {
                        this.gameResult = GameResult.Push;
                        this.playerFunds.addFunds(this.currentBet); // Return bet on push
                    } else {
                        this.gameResult = GameResult.PlayerBlackjack;
                        this.playerFunds.addFunds(this.currentBet * 2.5); // Blackjack pays 3:2
                    }
                    this.gameState = GameState.GameOver;
                    this.saveGameState();
                }, 500); // Delay after card flip
            }, 1000); // Delay before we flip dealer card
        }
        
        this.saveGameState();
        return true;
    }

    public playerHit(): void {
        if (this.gameState !== GameState.PlayerTurn && this.gameState !== GameState.DealerTurn) {
            return;
        }
        
        const targetHand = this.gameState === GameState.PlayerTurn 
            ? this.handManager.getPlayerHand() 
            : this.handManager.getDealerHand();
            
        this.handManager.dealCard(targetHand, true);
        
        // Check if player busts (only in PlayerTurn state)
        if (this.gameState === GameState.PlayerTurn) {
            const playerValue = ScoreCalculator.calculateHandValue(this.handManager.getPlayerHand());
            if (playerValue > 21) {
                // Allow time for animations
                setTimeout(() => {
                    this.handManager.revealDealerHoleCard(); // Reveal dealer's hole card
                    setTimeout(() => {
                        this.gameResult = GameResult.DealerWins;
                        this.gameState = GameState.GameOver;
                        this.saveGameState();
                    }, 500);
                }, 500);
            }
        }
        this.saveGameState();
    }

    public playerStand(): void {
        if (this.gameState !== GameState.PlayerTurn && this.gameState !== GameState.DealerTurn) {
            return;
        }
        
        if (this.gameState === GameState.PlayerTurn) {
            this.gameState = GameState.DealerTurn;
            
            // Reveal dealer's hole card with a slight delay
            setTimeout(() => {
                this.handManager.revealDealerHoleCard();
                this.saveGameState(); // Save state after flipping the card
            }, 500);
            
            return; // Don't proceed to game over - dealer will take their turn
        }
        
        // If we're already in dealer turn, this means the dealer is done
        if (this.gameState === GameState.DealerTurn) {
            // Determine the winner
            const playerValue = ScoreCalculator.calculateHandValue(this.handManager.getPlayerHand());
            const dealerValue = ScoreCalculator.calculateHandValue(this.handManager.getDealerHand());
            
            if (dealerValue > 21 || playerValue > dealerValue) {
                this.gameResult = GameResult.PlayerWins;
                this.playerFunds.addFunds(this.currentBet * 2); // Win pays 1:1
            } else if (dealerValue > playerValue) {
                this.gameResult = GameResult.DealerWins;
            } else {
                this.gameResult = GameResult.Push;
                this.playerFunds.addFunds(this.currentBet); // Return bet on push
            }
            
            this.gameState = GameState.GameOver;
        }
        this.saveGameState();
    }

    public doubleDown(): boolean {
        if (this.gameState !== GameState.PlayerTurn || this.handManager.getPlayerHand().length > 2) {
            return false;
        }
        
        // Check if player has enough funds to double down
        if (!this.playerFunds.deductFunds(this.currentBet)) {
            return false;
        }
        
        // Double the bet
        this.currentBet *= 2;
        
        // Deal one more card to player
        this.handManager.dealCard(this.handManager.getPlayerHand(), true);
        
        // Allow animation to complete before standing
        setTimeout(() => {
            // Automatically stand after doubling down
            this.playerStand();
        }, 1000);
        
        this.saveGameState();
        return true;
    }

    private saveGameState(): void {
        GameStorage.saveGameState(
            this.gameState,
            this.currentBet,
            this.gameResult,
            this.handManager.getPlayerHand(),
            this.handManager.getDealerHand()
        );
    }

    public loadGameState(): boolean {
        const state = GameStorage.loadGameState();
        if (!state.gameState) {
            return false;
        }

        this.gameState = state.gameState;
        
        if (state.currentBet) {
            this.currentBet = state.currentBet;
            this.lastBet = this.currentBet;
        }
        
        if (state.gameResult) {
            this.gameResult = state.gameResult;
        }

        return true;
    }
}
