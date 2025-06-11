// src/game/deck.ts
// Use centralized constants
import { Card, Suit, Rank } from "./Card";
import { Constants } from "../Constants";

export class Deck {
    private cards: Card[];

    /**
     * Creates a new deck of cards.
     * @param numDecks The number of decks to include in the game. Default is 1.
     */
    constructor(numDecks: number = 1) { // Allow multiple decks
        this.cards = [];
        this.initializeDeck(numDecks);
        this.shuffle();
        console.log(`[Deck] Initialized with ${numDecks} deck(s), ${this.cards.length} cards total.`);
    }

    /**
     * Initializes the deck with the specified number of decks.
     * @param numDecks The number of decks to include in the game.
     */
    private initializeDeck(numDecks: number): void {
        this.cards = [];
        for (let d = 0; d < numDecks; d++) {
            for (const suit of Object.values(Suit)) {
                for (const rank of Object.values(Rank)) {
                    this.cards.push(new Card(suit as Suit, rank as Rank));
                }
            }
        }
    }

    /**
     * Shuffles the deck using the Fisher-Yates algorithm.
     */
    public shuffle(): void {
        console.log("[Deck] Shuffling deck...");
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    /**
     * Draws a card from the deck.
     * If the deck is low on cards, it will reshuffle.
     * @returns The drawn card or undefined if the deck is empty.
     */
    public drawCard(): Card | undefined {
        if (this.needsShuffle()) {
            console.log(`[Deck] Low cards (${this.cards.length}), reshuffling...`);
            this.reset();
        }
        if (this.cards.length === 0) {
            console.warn("[Deck] is empty!");
            return undefined;
        }
        return this.cards.pop();
    }

    /**
     * Returns the number of cards remaining in the deck.
     * @returns The number of cards left in the deck.
     */
    public getCardsRemaining(): number {
        return this.cards.length;
    }

    /**
     * Checks if the deck needs to be shuffled based on the number of cards left.
     * @returns True if the deck needs to be shuffled, false otherwise.
     */
    public needsShuffle(): boolean {
        return this.cards.length < Constants.MIN_CARDS_BEFORE_SHUFFLE;
    }

    /**
     * Resets the deck to its initial state with the specified number of decks.
     * Shuffles the deck after resetting.
     * @param numDecks The number of decks to include in the game. Default is 1.
     */
    public reset(numDecks: number = 1): void { // Use same number of decks
        console.log("[Deck] Resetting deck...");
        this.initializeDeck(numDecks);
        this.shuffle();
    }
}
