// src/game/deck.ts
// Use centralized constants
import { Card, Suit, Rank } from "./Card";
import { Constants } from "../Constants";

export class Deck {
    private cards: Card[];
    private numDecks: number;

    /**
     * Creates a new deck of cards.
     * @param numDecks The number of decks to include in the game. Default is 1.
     */
    constructor(numDecks: number = 1) { // Allow multiple decks
        this.numDecks = numDecks;
        this.cards = [];
        this.initializeDeck(this.numDecks);
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
     * Returns a copy of the cards currently in the deck for inspection.
     * @returns A copy of the cards array.
     */
    public getCards(): Card[] {
        return [...this.cards];
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
     */
    public reset(): void { // Use same number of decks
        console.log("[Deck] Resetting deck...");
        this.initializeDeck(this.numDecks);
        this.shuffle();
    }

    /**
     * DEBUG: Replaces the deck with only cards of rank '2' for testing splits.
     */
    public setDeckToTwos(): void {
        console.warn(`[Deck] DEBUG: Setting deck to all 2s using ${this.numDecks} deck(s).`);
        this.cards = [];
        const suits = Object.values(Suit);
        const totalCards = 52 * this.numDecks; // Create a full-sized shoe
        for (let i = 0; i < totalCards; i++) {
            // Cycle through suits to ensure some variety for visual components
            const suit = suits[i % suits.length] as Suit;
            this.cards.push(new Card(suit, Rank.Two));
        }
        this.shuffle();
    }

    /**
     * Finds and draws a card that matches a specific rank and/or suit.
     * This is primarily for debug/scenario setup.
     * @param rank The rank to match. Can be undefined to match any rank.
     * @param suit The suit to match. Can be undefined to match any suit.
     * @returns The drawn card or undefined if no matching card is found.
     */
    public findAndDrawCard(rank?: Rank, suit?: Suit): Card | undefined {
        const cardIndex = this.cards.findIndex(card =>
            (rank === undefined || card.getRank() === rank) &&
            (suit === undefined || card.getSuit() === suit)
        );

        if (cardIndex !== -1) {
            const card = this.cards.splice(cardIndex, 1)[0];
            return card;
        }
        return undefined;
    }
}
