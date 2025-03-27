// src/game/card-ts (Added uniqueId and getter)
export enum Suit {
    Hearts = "Hearts",
    Diamonds = "Diamonds",
    Clubs = "Clubs",
    Spades = "Spades"
}

export enum Rank {
    Two = "2",
    Three = "3",
    Four = "4",
    Five = "5",
    Six = "6",
    Seven = "7",
    Eight = "8",
    Nine = "9",
    Ten = "10",
    Jack = "J",
    Queen = "Q",
    King = "K",
    Ace = "A"
}

export class Card {
    private suit: Suit;
    private rank: Rank;
    private faceUp: boolean;
    // *** ADDED ***
    private _uniqueId: string; // For reliable map keys

    public onFlip: ((card: Card) => void) | null = null;

    constructor(suit: Suit, rank: Rank) {
        this.suit = suit;
        this.rank = rank;
        this.faceUp = false;
        // *** ADDED *** - Simple unique ID generation
        this._uniqueId = `${suit}-${rank}-${Date.now()}-${Math.random()}`;
    }

    // *** ADDED ***
    /**
     * Gets a unique identifier for this card instance.
     * Useful for using cards as keys in Maps.
     * @returns {string} A unique ID string.
     */
    public getUniqueId(): string {
        return this._uniqueId;
    }

    public getSuit(): Suit {
        return this.suit;
    }

    public getRank(): Rank {
        return this.rank;
    }

    public isFaceUp(): boolean {
        return this.faceUp;
    }

    public setFaceUp(value: boolean): void {
        // Check if state actually changed before potentially triggering flip logic
        const changed = this.faceUp !== value;
        this.faceUp = value;
        // If setting directly, we usually don't trigger the main 'flip' notification
        // But if needed for some reason, it could be added here conditionally
        // if (changed && this.onFlip) { this.onFlip(this); }
    }

    public flip(): void {
        this.faceUp = !this.faceUp;
        console.log(`Card ${this.toString()} flipped to ${this.faceUp ? 'up' : 'down'}. Notifying listeners.`);
        if (this.onFlip) {
            this.onFlip(this);
        } else {
             console.warn(`Card ${this.toString()} flipped, but no onFlip callback registered.`);
        }
    }

    public setFlipCallback(callback: (card: Card) => void): void {
        this.onFlip = callback;
    }

    public getValue(): number {
        switch (this.rank) {
            case Rank.Ace:
                return 11;
            case Rank.Jack:
            case Rank.Queen:
            case Rank.King:
                return 10;
            default:
                // Ensure rank is a number string before parsing
                const numericRank = parseInt(this.rank);
                return isNaN(numericRank) ? 0 : numericRank; // Should not happen with enum
        }
    }

    public toString(): string {
        return `${this.rank} of ${this.suit}`;
    }
}
