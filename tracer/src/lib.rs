use wasm_bindgen::prelude::*;

mod color_image;
pub use color_image::*;

#[cfg(feature = "console_error_panic_hook")]
use console_error_panic_hook;

#[wasm_bindgen]
pub fn init_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}
