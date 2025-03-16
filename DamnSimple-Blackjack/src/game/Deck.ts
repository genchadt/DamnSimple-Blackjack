// ./game/Decks.ts
import { Card, Suit, Rank } from "./Card";

export class Deck {
    private cards: Card[];

    /**
     * Constructs a new Deck instance.
     * Initializes an empty array of cards, populates it with a standard 52-card deck,
     * and shuffles the deck to randomize the order of the cards.
     */
    constructor() {
        this.cards = [];
        this.initializeDeck();
        this.shuffle();
    }

    /**
     * Initializes the deck with all 52 possible card combinations.
     * Uses nested for-loops to create all possible combinations of suits and ranks,
     * and pushes each to the internal cards array.
     */
    private initializeDeck(): void {
        // Create a full deck of 52 cards
        for (const suit of Object.values(Suit)) {
            for (const rank of Object.values(Rank)) {
                this.cards.push(new Card(suit as Suit, rank as Rank));
            }
        }
    }

    /**
     * Randomizes the order of the cards in the deck using the Fisher-Yates shuffle algorithm.
     * Iterates over the deck array from the last element to the second element,
     * swapping each element with a randomly selected element that comes before it or is itself.
     */
    public shuffle(): void {
        // Fisher-Yates shuffle algorithm
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    /**
     * Draws the top card from the deck and returns it, or undefined if the deck is empty.
     * 
     * @returns {Card | undefined} The drawn card, or undefined if the deck is empty.
     */
    public drawCard(): Card | undefined {
        if (this.cards.length === 0) {
            return undefined;
        }
        return this.cards.pop();
    }

    /**
     * Retrieves the number of cards remaining in the deck.
     * 
     * @returns {number} The number of cards remaining in the deck.
     */
    public getCardsRemaining(): number {
        return this.cards.length;
    }

    /**
     * Resets the deck by clearing the current deck of cards, reinitializing with a full deck of 52 cards,
     * and shuffling the deck to randomize the order of the cards.
     */
    public reset(): void {
        this.cards = [];
        this.initializeDeck();
        this.shuffle();
    }
}
