// ./game/Decks.ts
import { Card, Suit, Rank } from "./Card";

export class Deck {
    private cards: Card[];

    constructor() {
        this.cards = [];
        this.initializeDeck();
        this.shuffle();
    }

    private initializeDeck(): void {
        // Create a full deck of 52 cards
        for (const suit of Object.values(Suit)) {
            for (const rank of Object.values(Rank)) {
                this.cards.push(new Card(suit as Suit, rank as Rank));
            }
        }
    }

    public shuffle(): void {
        // Fisher-Yates shuffle algorithm
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    public drawCard(): Card | undefined {
        if (this.cards.length === 0) {
            return undefined;
        }
        return this.cards.pop();
    }

    public getCardsRemaining(): number {
        return this.cards.length;
    }

    public reset(): void {
        this.cards = [];
        this.initializeDeck();
        this.shuffle();
    }
}
