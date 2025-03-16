// game/HandManager.ts
import { Card } from "./Card";
import { Deck } from "./Deck";

export class HandManager {
    private deck: Deck;
    private playerHand: Card[] = [];
    private dealerHand: Card[] = [];
    private cardFlipCallbacks: ((card: Card) => void)[] = [];

    constructor() {
        this.deck = new Deck();
    }

    public resetHands(): void {
        this.playerHand = [];
        this.dealerHand = [];
    }

    public getPlayerHand(): Card[] {
        return this.playerHand;
    }

    public getDealerHand(): Card[] {
        return this.dealerHand;
    }

    public addCardFlipCallback(callback: (card: Card) => void): void {
        this.cardFlipCallbacks.push(callback);
    }

    public dealCard(hand: Card[], faceUp: boolean): void {
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
                    card.setFaceUp(true);
                    if (card.onFlip) {
                        card.onFlip(card);
                    }
                }, 300);
            }
        }
    }

    public dealInitialCards(): void {
        // First dealer card face down
        this.dealCard(this.dealerHand, false);
        
        // First player card face up
        this.dealCard(this.playerHand, true);
        
        // Second dealer card face up
        this.dealCard(this.dealerHand, true);
        
        // Second player card face up
        this.dealCard(this.playerHand, true);
    }

    public refreshDeckIfNeeded(): void {
        if (this.deck.getCardsRemaining() < 15) {
            this.deck.reset();
        }
    }

    public revealDealerHoleCard(): void {
        if (this.dealerHand.length > 0) {
            this.dealerHand[0].flip();
        }
    }
}
