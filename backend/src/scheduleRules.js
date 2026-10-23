// untuk cutoff pemesanan kursi

const { BOOKING_CUTOFF_MINUTES } = require("./config"); 
const bookingCloseAt = (departureAt) =>
    Date.parse(departureAt) - BOOKING_CUTOFF_MINUTES * 60 * 1000;

const isBookingClosed = (departureAt, t) => t >= bookingCloseAt(departureAt);

module.exports = { bookingCloseAt, isBookingClosed };