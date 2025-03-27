// src/game/deck-ts (Added needsShuffle method)
import { Card, Suit, Rank } from "./Card";

export class Deck {
    private cards: Card[];
    // *** ADDED ***
    private static readonly MIN_CARDS_BEFORE_SHUFFLE = 15; // Example threshold

    constructor(numDecks: number = 1) { // Allow multiple decks
        this.cards = [];
        this.initializeDeck(numDecks);
        this.shuffle();
        console.log(`Deck initialized with ${numDecks} deck(s), ${this.cards.length} cards total.`);
    }

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

    public shuffle(): void {
        console.log("Shuffling deck...");
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    public drawCard(): Card | undefined {
        // *** MODIFIED *** - Check shuffle *before* drawing if low
        if (this.needsShuffle()) {
             console.log(`Low cards (${this.cards.length}), reshuffling...`);
             this.reset(); // Resets and shuffles
        }
        if (this.cards.length === 0) {
            console.warn("Deck is empty!");
            return undefined;
        }
        return this.cards.pop();
    }

    public getCardsRemaining(): number {
        return this.cards.length;
    }

    // *** ADDED ***
    public needsShuffle(): boolean {
        return this.cards.length < Deck.MIN_CARDS_BEFORE_SHUFFLE;
    }

    public reset(numDecks: number = 1): void { // Use same number of decks
        console.log("Resetting deck...");
        this.initializeDeck(numDecks);
        this.shuffle();
    }
}
