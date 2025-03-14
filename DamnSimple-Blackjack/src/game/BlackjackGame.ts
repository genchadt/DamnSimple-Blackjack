// ./game/BlackjackGame.ts
import { Card } from "./Card";
import { Deck } from "./Deck";

export enum GameState {
    Betting,
    PlayerTurn,
    DealerTurn,
    GameOver
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

    constructor() {
        this.deck = new Deck();
        this.playerHand = [];
        this.dealerHand = [];
        this.gameState = GameState.Betting;
        this.gameResult = GameResult.InProgress;
    }

    public startNewGame(): void {
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
            } else {
                this.gameResult = GameResult.PlayerBlackjack;
            }
            this.gameState = GameState.GameOver;
        }
    }

    public playerHit(): void {
        if (this.gameState !== GameState.PlayerTurn) {
            return;
        }
        
        this.dealCard(this.playerHand, true);
        
        // Check if player busts
        if (this.calculateHandValue(this.playerHand) > 21) {
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
        } else if (dealerValue > playerValue) {
            this.gameResult = GameResult.DealerWins;
        } else {
            this.gameResult = GameResult.Push;
        }
        
        this.gameState = GameState.GameOver;
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
}
