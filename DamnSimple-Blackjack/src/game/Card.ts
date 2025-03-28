// src/game/card-ts (Ensure getRankValueForTexture is present)
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
    private _uniqueId: string;

    public onFlip: ((card: Card) => void) | null = null;

    constructor(suit: Suit, rank: Rank) {
        this.suit = suit;
        this.rank = rank;
        this.faceUp = false;
        this._uniqueId = `${suit}-${rank}-${Date.now()}-${Math.random()}`;
    }

    public getUniqueId(): string {
        return this._uniqueId;
    }

    public getSuit(): Suit {
        return this.suit;
    }

    public getRank(): Rank {
        return this.rank;
    }

    // *** ENSURE THIS METHOD IS PRESENT ***
    /**
     * Gets the numeric rank value used for texture filenames.
     * Ace=1, 2-10, Jack=11, Queen=12, King=13.
     * @returns {number} The numeric rank value.
     */
    public getRankValueForTexture(): number {
        switch (this.rank) {
            case Rank.Ace: return 1;
            case Rank.Jack: return 11;
            case Rank.Queen: return 12;
            case Rank.King: return 13;
            default: return parseInt(this.rank); // Handles "2" through "10"
        }
    }

    public isFaceUp(): boolean {
        return this.faceUp;
    }

    public setFaceUp(value: boolean): void {
        const changed = this.faceUp !== value;
        this.faceUp = value;
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
            case Rank.Ace: return 11;
            case Rank.Jack:
            case Rank.Queen:
            case Rank.King: return 10;
            default:
                const numericRank = parseInt(this.rank);
                return isNaN(numericRank) ? 0 : numericRank;
        }
    }

    public toString(): string {
        return `${this.rank} of ${this.suit}`;
    }
}
