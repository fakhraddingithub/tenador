import {
  firstAddressError,
  validateAddressPayload,
} from "../src/lib/addressForm.mjs";

export const validateAddress = (data) => firstAddressError(validateAddressPayload(data));
