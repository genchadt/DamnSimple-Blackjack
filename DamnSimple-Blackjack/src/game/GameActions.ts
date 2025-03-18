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

    /**
     * Initializes a new instance of the GameActions class with the specified
     * HandManager and PlayerFunds instances.
     *
     * @param {HandManager} handManager - The hand manager responsible for managing
     * the cards and hands in the game.
     * @param {PlayerFunds} playerFunds - The player funds manager responsible for
     * tracking and managing the player's funds.
     */
    constructor(handManager: HandManager, playerFunds: PlayerFunds) {
        this.handManager = handManager;
        this.playerFunds = playerFunds;
    }

    /**
     * Sets the game state to the given value, saving the new state to local storage.
     * @param state The new game state to set.
     */
    public setGameState(state: GameState): void {
        this.gameState = state;
        this.saveGameState();
    }

    /**
     * Retrieves the current game state.
     * 
     * @return {GameState} The current state of the game, which is one of
     * Initial, Betting, PlayerTurn, DealerTurn, or GameOver.
     */
    public getGameState(): GameState {
        return this.gameState;
    }

    /**
     * Retrieves the result of the current game.
     * 
     * @return {GameResult} The result of the game, indicating whether the player
     * wins, the dealer wins, a push occurs, a player blackjack, or if the game
     * is still in progress.
     */
    public getGameResult(): GameResult {
        return this.gameResult;
    }

    /**
     * Retrieves the current bet amount for the game.
     * 
     * @return {number} The current bet amount.
     */
    public getCurrentBet(): number {
        return this.currentBet;
    }

    /**
     * Sets the current bet amount to the specified value.
     * If the amount is valid (positive and less than or equal to the player's funds),
     * the current bet will be updated and saved to local storage.
     * @param amount The bet amount to set.
     */
    public setCurrentBet(amount: number): void {
        if (amount > 0 && amount <= this.playerFunds.getFunds()) {
            this.currentBet = amount;
        }
    }

    /**
     * Starts a new game of blackjack with the specified bet amount.
     * This method will:
     * - Check if the player has enough funds to play with the specified bet
     *   amount. If not, the method will return false.
     * - Deduct the bet amount from the player's funds.
     * - Reset both player and dealer hands.
     * - Refresh the deck if needed.
     * - Deal two cards to both the player and dealer.
     * - Set the game state to GameState.PlayerTurn.
     * - Set the game result to GameResult.InProgress.
     * - Check if the player has a blackjack (Ace and 10-value card as initial
     *   two cards). If so, the method will trigger a game over with the result
     *   set to GameResult.PlayerBlackjack or GameResult.Push, depending on if
     *   the dealer also has a blackjack.
     * - Save the game state to local storage.
     * 
     * @param {number} [bet=this.lastBet] The amount to bet for the new game.
     * 
     * @returns {boolean} - true if the game was started successfully, false if
     *   not (player does not have enough funds).
     */
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

    /**
     * Executes a hit action for the player or dealer.
     * If the player busts, the dealer's hole card is revealed and the game ends.
     * If the dealer busts, the player wins.
     */
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

    /**
     * Handles the player's decision to stand, transitioning the game state accordingly.
     * - If the player stands during their turn, the game state changes to `DealerTurn`,
     *   and the dealer's hole card is revealed after a slight delay.
     * - If the player stands during the dealer's turn, it signifies the end of the dealer's moves.
     *   The winner is determined by comparing the player's and dealer's hand values:
     *   - The player wins if the dealer busts or if the player's hand value is greater.
     *   - The dealer wins if their hand value is greater than the player's.
     *   - A tie (push) occurs if both hand values are equal.
     * - The game state is set to `GameOver` after determining the result, and the game state is saved.
     */
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

    /**
     * Doubles the current bet and deals one more card to the player's hand.
     * After doubling down, the player is automatically forced to stand.
     * If the player does not have enough funds to double down, the action
     * will be cancelled and false will be returned.
     * 
     * @returns true if the double down action was successful, otherwise false.
     */
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

    /**
     * Saves the current game state to local storage.
     * This includes the game state, current bet, game result, and both player
     * and dealer hands, serializing each hand to JSON format.
     */
    private saveGameState(): void {
        GameStorage.saveGameState(
            this.gameState,
            this.currentBet,
            this.gameResult,
            this.handManager.getPlayerHand(),
            this.handManager.getDealerHand()
        );
    }

    /**
     * Loads the game state from local storage. If the state is not saved, the
     * method will return false. Otherwise, it will return true.
     *
     * @returns {boolean} - Returns true if the state is loaded successfully, false if not.
     */
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
