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

    constructor() {
        this.deck = new Deck();
        this.playerHand = [];
        this.dealerHand = [];
        this.gameState = GameState.Betting;
        this.gameResult = GameResult.InProgress;
        this.playerFunds = new PlayerFunds();
    }

    public setGameState(state: GameState): void {
        this.gameState = state;
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
        
        // Deal initial cards
        this.dealCard(this.playerHand, true);
        this.dealCard(this.dealerHand, false); // Dealer's first card is face down
        this.dealCard(this.playerHand, true);
        this.dealCard(this.dealerHand, true);
        
        this.gameState = GameState.PlayerTurn;
        this.gameResult = GameResult.InProgress;
        
        // Check for blackjack
        if (this.calculateHandValue(this.playerHand) === 21) {
            this.dealerHand[0].flip(); // Reveal dealer's hole card
            if (this.calculateHandValue(this.dealerHand) === 21) {
                this.gameResult = GameResult.Push;
                this.playerFunds.addFunds(this.currentBet); // Return bet on push
            } else {
                this.gameResult = GameResult.PlayerBlackjack;
                this.playerFunds.addFunds(this.currentBet * 2.5); // Blackjack pays 3:2
            }
            this.gameState = GameState.GameOver;
        }
        
        return true;
    }

    public playerHit(): void {
        if (this.gameState !== GameState.PlayerTurn) {
            return;
        }
        
        this.dealCard(this.playerHand, true);
        
        // Check if player busts
        const playerValue = this.calculateHandValue(this.playerHand);
        if (playerValue > 21) {
            this.dealerHand[0].flip(); // Reveal dealer's hole card
            this.gameResult = GameResult.DealerWins;
            this.gameState = GameState.GameOver;
        }
    }

    public playerStand(): void {
        if (this.gameState !== GameState.PlayerTurn) {
            return;
        }
        
        this.gameState = GameState.DealerTurn;
        this.dealerHand[0].flip(); // Reveal dealer's hole card
        
        // Dealer must hit until they have at least 17
        while (this.calculateHandValue(this.dealerHand) < 17) {
            this.dealCard(this.dealerHand, true);
        }
        
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

    private lastBet: number = 10;

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
        
        // Automatically stand after doubling down
        this.playerStand();
        
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
            if (faceUp) {
                card.flip();
            }
            hand.push(card);
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
