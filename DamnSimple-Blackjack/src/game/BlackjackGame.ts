// game/BlackjackGame.ts
import { Card } from "./Card";
import { Deck } from "./Deck";
import { PlayerFunds } from "./PlayerFunds";

export enum GameState {
    Initial,      // Initial state - empty table
    Betting,      // Player setting bet
    PlayerTurn,   // Player's turn to hit/stand
    DealerTurn,   // Dealer's turn
    GameOver      // Game ended
}

export enum GameResult {
    PlayerWins,
    DealerWins,
    Push,
    PlayerBlackjack,
    InProgress
}

export class BlackjackGame {
    private deck: Deck;
    private playerHand: Card[];
    private dealerHand: Card[];
    private gameState: GameState;
    private gameResult: GameResult;
    private playerFunds: PlayerFunds;
    private currentBet: number = 0;
    private defaultBet: number = 10;
    private lastBet: number = 10;

    private static readonly STORAGE_KEY_STATE = "damnSimpleBlackjack_gameState";
    private static readonly STORAGE_KEY_PLAYER_HAND = "damnSimpleBlackjack_playerHand";
    private static readonly STORAGE_KEY_DEALER_HAND = "damnSimpleBlackjack_dealerHand";
    private static readonly STORAGE_KEY_BET = "damnSimpleBlackjack_currentBet";
    private static readonly STORAGE_KEY_RESULT = "damnSimpleBlackjack_gameResult";

    constructor() {
        this.deck = new Deck();
        this.playerHand = [];
        this.dealerHand = [];
        this.gameState = GameState.Initial; // Start in Initial state
        this.gameResult = GameResult.InProgress;
        this.playerFunds = new PlayerFunds();

        this.tryRestoreGameState();
    }

    public setGameState(state: GameState): void {
        this.gameState = state;
        this.saveGameState();
    }

    private tryRestoreGameState(): void {
        try {
            const savedState = localStorage.getItem(BlackjackGame.STORAGE_KEY_STATE);
            if (savedState) {
                this.gameState = parseInt(savedState);
                
                // Only restore cards if we're in a valid game state
                if (this.gameState !== GameState.Initial) {
                    const savedBet = localStorage.getItem(BlackjackGame.STORAGE_KEY_BET);
                    if (savedBet) {
                        this.currentBet = parseInt(savedBet);
                        this.lastBet = this.currentBet;
                    }
                    
                    const savedResult = localStorage.getItem(BlackjackGame.STORAGE_KEY_RESULT);
                    if (savedResult) {
                        this.gameResult = parseInt(savedResult);
                    }
                    
                    // Restore player hand
                    const playerHandJson = localStorage.getItem(BlackjackGame.STORAGE_KEY_PLAYER_HAND);
                    if (playerHandJson) {
                        const playerHandData = JSON.parse(playerHandJson);
                        this.playerHand = playerHandData.map((cardData: any) => {
                            const card = new Card(cardData.suit, cardData.rank);
                            if (cardData.faceUp) {
                                // Set faceUp without triggering callbacks
                                card.setFaceUp(true);
                            }
                            return card;
                        });
                    }
                    
                    // Restore dealer hand
                    const dealerHandJson = localStorage.getItem(BlackjackGame.STORAGE_KEY_DEALER_HAND);
                    if (dealerHandJson) {
                        const dealerHandData = JSON.parse(dealerHandJson);
                        this.dealerHand = dealerHandData.map((cardData: any) => {
                            const card = new Card(cardData.suit, cardData.rank);
                            if (cardData.faceUp) {
                                // Set faceUp without triggering callbacks
                                card.setFaceUp(true);
                            }
                            return card;
                        });
                    }
                }
            }
        } catch (error) {
            console.error("Error restoring game state:", error);
            // If restoration fails, reset to initial state
            this.gameState = GameState.Initial;
            this.playerHand = [];
            this.dealerHand = [];
        }
    }
    
    private saveGameState(): void {
        try {
            localStorage.setItem(BlackjackGame.STORAGE_KEY_STATE, this.gameState.toString());
            localStorage.setItem(BlackjackGame.STORAGE_KEY_BET, this.currentBet.toString());
            localStorage.setItem(BlackjackGame.STORAGE_KEY_RESULT, this.gameResult.toString());
            
            // Save player hand
            const playerHandData = this.playerHand.map(card => ({
                suit: card.getSuit(),
                rank: card.getRank(),
                faceUp: card.isFaceUp()
            }));
            localStorage.setItem(BlackjackGame.STORAGE_KEY_PLAYER_HAND, JSON.stringify(playerHandData));
            
            // Save dealer hand
            const dealerHandData = this.dealerHand.map(card => ({
                suit: card.getSuit(),
                rank: card.getRank(),
                faceUp: card.isFaceUp()
            }));
            localStorage.setItem(BlackjackGame.STORAGE_KEY_DEALER_HAND, JSON.stringify(dealerHandData));
        } catch (error) {
            console.error("Error saving game state:", error);
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
        this.playerHand = [];
        this.dealerHand = [];
        
        // Refresh deck if needed
        if (this.deck.getCardsRemaining() < 15) {
            this.deck.reset();
        }
        
        // Deal initial cards - this happens sequentially in UI now
        this.dealCard(this.playerHand, true);
        this.dealCard(this.dealerHand, false); // Dealer's first card is face down
        this.dealCard(this.playerHand, true);
        this.dealCard(this.dealerHand, true);
        
        this.gameState = GameState.PlayerTurn;
        this.gameResult = GameResult.InProgress;
        
        // Check for blackjack
        if (this.calculateHandValue(this.playerHand) === 21) {
            // Allow time for animations before we reveal cards and end game
            setTimeout(() => {
                this.dealerHand[0].flip(); // Reveal dealer's hole card
                setTimeout(() => {
                    if (this.calculateHandValue(this.dealerHand) === 21) {
                        this.gameResult = GameResult.Push;
                        this.playerFunds.addFunds(this.currentBet); // Return bet on push
                    } else {
                        this.gameResult = GameResult.PlayerBlackjack;
                        this.playerFunds.addFunds(this.currentBet * 2.5); // Blackjack pays 3:2
                    }
                    this.gameState = GameState.GameOver;
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
        
        this.dealCard(this.targetHand(), true);
        
        // Check if player busts (only in PlayerTurn state)
        if (this.gameState === GameState.PlayerTurn) {
            const playerValue = this.calculateHandValue(this.playerHand);
            if (playerValue > 21) {
                // Allow time for animations
                setTimeout(() => {
                    this.dealerHand[0].flip(); // Reveal dealer's hole card
                    setTimeout(() => {
                        this.gameResult = GameResult.DealerWins;
                        this.gameState = GameState.GameOver;
                    }, 500);
                }, 500);
            }
        }
        this.saveGameState();
    }
    
    // Helper method to determine which hand to add cards to
    private targetHand(): Card[] {
        return this.gameState === GameState.PlayerTurn ? this.playerHand : this.dealerHand;
    }

    public playerStand(): void {
        if (this.gameState !== GameState.PlayerTurn && this.gameState !== GameState.DealerTurn) {
            return;
        }
        
        if (this.gameState === GameState.PlayerTurn) {
            this.gameState = GameState.DealerTurn;
            
            // Reveal dealer's hole card with a slight delay
            setTimeout(() => {
                this.dealerHand[0].flip();
            }, 500);
            
            return; // Don't proceed to game over - dealer will take their turn
        }
        
        // If we're already in dealer turn, this means the dealer is done
        if (this.gameState === GameState.DealerTurn) {
            // Determine the winner
            const playerValue = this.calculateHandValue(this.playerHand);
            const dealerValue = this.calculateHandValue(this.dealerHand);
            
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

    public setCurrentBet(amount: number): void {
        if (amount > 0 && amount <= this.playerFunds.getFunds()) {
            this.currentBet = amount;
        }
    }
    
    public doubleDown(): boolean {
        if (this.gameState !== GameState.PlayerTurn || this.playerHand.length > 2) {
            return false;
        }
        
        // Check if player has enough funds to double down
        if (!this.playerFunds.deductFunds(this.currentBet)) {
            return false;
        }
        
        // Double the bet
        this.currentBet *= 2;
        
        // Deal one more card to player
        this.dealCard(this.playerHand, true);
        
        // Allow animation to complete before standing
        setTimeout(() => {
            // Automatically stand after doubling down
            this.playerStand();
        }, 1000);
        
        this.saveGameState();
        return true;
    }
    
    public canSplit(): boolean {
        return this.playerHand.length === 2 && 
               this.playerHand[0].getValue() === this.playerHand[1].getValue() &&
               this.playerFunds.getFunds() >= this.currentBet;
    }

    private cardFlipCallbacks: ((card: Card) => void)[] = [];

    public addCardFlipCallback(callback: (card: Card) => void): void {
        this.cardFlipCallbacks.push(callback);
    }

    private dealCard(hand: Card[], faceUp: boolean): void {
        const card = this.deck.drawCard();
        if (card) {
            // Add the card to the hand first
            hand.push(card);
            
            // Set up flip callback for this card
            for (const callback of this.cardFlipCallbacks) {
                card.setFlipCallback(callback);
            }
            
            // Then flip it if needed (with slight delay to allow rendering)
            if (faceUp) {
                setTimeout(() => {
                    card.flip();
                }, 300);
            }
        }
    }

    public calculateHandValue(hand: Card[]): number {
        let value = 0;
        let aces = 0;
        
        // Count all non-ace cards first
        for (const card of hand) {
            if (card.isFaceUp()) {
                if (card.getRank() === "A") {
                    aces++;
                } else {
                    value += card.getValue();
                }
            }
        }
        
        // Handle aces optimally
        for (let i = 0; i < aces; i++) {
            if (value + 11 <= 21) {
                value += 11;
            } else {
                value += 1;
            }
        }
        
        return value;
    }

    public getPlayerHand(): Card[] {
        return this.playerHand;
    }

    public getDealerHand(): Card[] {
        return this.dealerHand;
    }

    public getGameState(): GameState {
        return this.gameState;
    }

    public getGameResult(): GameResult {
        return this.gameResult;
    }

    public getPlayerScore(): number {
        return this.calculateHandValue(this.playerHand);
    }

    public getDealerScore(): number {
        return this.calculateHandValue(this.dealerHand);
    }
    
    public getPlayerFunds(): number {
        return this.playerFunds.getFunds();
    }
    
    public getCurrentBet(): number {
        return this.currentBet;
    }
    
    public resetFunds(): void {
        this.playerFunds.resetFunds();
    }
}
