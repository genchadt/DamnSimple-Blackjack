// game/HandManager.ts
import { Card } from "./Card";
import { Deck } from "./Deck";

export class HandManager {
    private deck: Deck;
    private playerHand: Card[] = [];
    private dealerHand: Card[] = [];
    private cardFlipCallbacks: ((card: Card) => void)[] = [];

    /**
     * Creates a new instance of the HandManager class.
     * 
     * This constructor initializes a new instance of the Deck class and assigns it to the deck property.
     */
    constructor() {
        this.deck = new Deck();
    }

    /**
     * Resets the player's and dealer's hands to empty arrays.
     */
    public resetHands(): void {
        this.playerHand = [];
        this.dealerHand = [];
    }

    /**
     * Retrieves the player's hand.
     * 
     * @returns {Card[]} The player's hand of cards.
     */
    public getPlayerHand(): Card[] {
        return this.playerHand;
    }

    /**
     * Retrieves the dealer's hand.
     * 
     * @returns {Card[]} The dealer's hand of cards.
     */
    public getDealerHand(): Card[] {
        return this.dealerHand;
    }

    /**
     * Adds a callback function to be called when a card is flipped.
     * The callback receives the card instance as an argument.
     * 
     * @param {((card: Card) => void)} callback - The function to be called when a card is flipped.
     */
    public addCardFlipCallback(callback: (card: Card) => void): void {
        this.cardFlipCallbacks.push(callback);
    }

    /**
     * Deals a card to the specified hand and sets its face-up state.
     * 
     * @param {Card[]} hand - The hand to which the card will be added.
     * @param {boolean} faceUp - If true, the card will be flipped face up; otherwise, it remains face down.
     * 
     * The card is drawn from the deck and added to the specified hand. If the card is to be face up,
     * it is flipped after a short delay to allow for rendering. The function also sets up any card flip
     * callbacks that have been registered.
     */
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

    /**
     * Deals the initial cards to the player and dealer, with the first dealer card
     * face down (hole card) and all other cards face up.
     */
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

    /**
     * Resets the deck when there are less than 15 cards remaining to prevent the deck
     * from running out of cards mid-game.
     */
    public refreshDeckIfNeeded(): void {
        if (this.deck.getCardsRemaining() < 15) {
            this.deck.reset();
        }
    }

    /**
     * Reveals the dealer's hole card by flipping the first card in the dealer's hand.
     * This action is typically performed at the end of the player's turn or game
     * when the dealer's hand needs to be fully visible for score evaluation.
     */
    public revealDealerHoleCard(): void {
        if (this.dealerHand.length > 0) {
            this.dealerHand[0].flip();
        }
    }
}
