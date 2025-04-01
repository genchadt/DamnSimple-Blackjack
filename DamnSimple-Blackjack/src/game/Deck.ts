// src/game/deck.ts
// Use centralized constants
import { Card, Suit, Rank } from "./Card";
import { Constants } from "../Constants"; // *** IMPORT Constants ***

export class Deck {
    private cards: Card[];
    // *** REMOVED static MIN_CARDS_BEFORE_SHUFFLE ***

    constructor(numDecks: number = 1) { // Allow multiple decks
        this.cards = [];
        this.initializeDeck(numDecks);
        this.shuffle();
        console.log(`[Deck] Initialized with ${numDecks} deck(s), ${this.cards.length} cards total.`);
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
        console.log("[Deck] Shuffling deck...");
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

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

    public getCardsRemaining(): number {
        return this.cards.length;
    }

    public needsShuffle(): boolean {
        // *** USE Constant ***
        return this.cards.length < Constants.MIN_CARDS_BEFORE_SHUFFLE;
    }

    public reset(numDecks: number = 1): void { // Use same number of decks
        console.log("[Deck] Resetting deck...");
        this.initializeDeck(numDecks);
        this.shuffle();
    }
}
