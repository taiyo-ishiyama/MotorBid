using AuctionService.Entities;

namespace AuctionService.Unit.Tests;

public class AuctionEntityTests
{
    [Fact]
    public void HasReservePrice_ReservePriceGtZero_True()
    {
        var auction = new Auction { Id = Guid.NewGuid(), ReservePrice = 10, Seller = "bob" };

        var result = auction.HasReservePrice();

        Assert.True(result);
    }

    [Fact]
    public void HasReservePrice_ReservePriceIsZero_False()
    {
        var auction = new Auction { Id = Guid.NewGuid(), ReservePrice = 0, Seller = "bob" };

        var result = auction.HasReservePrice();

        Assert.False(result);
    }
}
