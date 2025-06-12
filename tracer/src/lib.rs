use wasm_bindgen::prelude::*;
use web_sys::{ImageData};
use visioncortex::{
    Color, ColorImage,
    color_clusters::{
        Runner,
        RunnerConfig,
        KeyingAction,
    },
    BinaryImage,
};

pub fn add(left: u64, right: u64) -> u64 {
    left + right
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = add(2, 2);
        assert_eq!(result, 4);
    }
}

#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub struct TraceOptions {
    pub color_count: u32,
    pub min_color_count: u32,
    pub max_color_count: u32,
    pub turd_size: u32,
    pub corner_threshold: f64,
    pub splice_threshold: f64,
    pub color_precision: u32,
    pub path_precision: u32,
    pub force_color_count: bool,
    pub hierarchical: u32,
    pub keep_details: bool,
    pub diagonal: bool,
    pub batch_size: i32,
    pub good_min_area: usize,
    pub good_max_area: usize,
    pub is_same_color_a: i32,
    pub is_same_color_b: i32,
    pub deepen_diff: i32,
    pub hollow_neighbours: usize,
}

#[wasm_bindgen]
impl TraceOptions {
    #[wasm_bindgen(constructor)]
    pub fn new() -> TraceOptions {
        TraceOptions {
            color_count: 32,
            min_color_count: 32,
            max_color_count: 32,
            turd_size: 20,
            corner_threshold: 60.0,
            splice_threshold: 45.0,
            color_precision: 8,
            path_precision: 8,
            force_color_count: true,
            hierarchical: 1,
            keep_details: true,
            diagonal: false,
            batch_size: 25600,
            good_min_area: 16,
            good_max_area: 256 * 256,
            is_same_color_a: 4,
            is_same_color_b: 1,
            deepen_diff: 64,
            hollow_neighbours: 1,
        }
    }
}

#[wasm_bindgen]
pub fn process_image(image_data: ImageData, options: TraceOptions) -> Result<JsValue, JsValue> {
    let width = image_data.width() as usize;
    let height = image_data.height() as usize;
    let data = image_data.data();

    let mut color_image = ColorImage::new();
    color_image.pixels.resize(width * height, 0);

    for y in 0..height {
        for x in 0..width {
            let i = (y * width + x) * 4;
            let color = Color::new(
                data[i],     // r
                data[i + 1], // g
                data[i + 2], // b
            );
            color_image.set_pixel(x, y, &color);
        }
    }

    let runner_config = RunnerConfig {
        diagonal: options.diagonal,
        hierarchical: options.hierarchical,
        batch_size: options.batch_size,
        good_min_area: options.good_min_area,
        good_max_area: options.good_max_area,
        is_same_color_a: options.is_same_color_a,
        is_same_color_b: options.is_same_color_b,
        deepen_diff: options.deepen_diff,
        hollow_neighbours: options.hollow_neighbours,
        key_color: Color::default(),
        keying_action: KeyingAction::default(),
    };

    let runner = Runner::new(runner_config, color_image);
    let clusters = runner.run();

    // Process clusters into paths
    let paths = js_sys::Array::new();
    let view = clusters.view();
    for index in view.clusters_output.iter() {
        let cluster = view.get_cluster(*index);
        let color = cluster.residue_color();

        // Create binary image for this cluster
        let mut binary_image = BinaryImage::new_w_h(view.width as usize, view.height as usize);
        cluster.render_to_binary_image(&view, &mut binary_image);

        // Create a spline from the binary image
        let spline = visioncortex::Spline::from_image(
            &binary_image,
            true, // clockwise
            options.corner_threshold.to_radians(),
            1.0, // outset_ratio
            1.0, // segment_length
            4,   // max_iterations
            options.splice_threshold.to_radians(), // splice_threshold
        );

        // Convert spline to SVG path string
        let path_string = spline.to_svg_string(true, &visioncortex::PointF64::default(), Some(options.path_precision));

        let path_obj = js_sys::Object::new();
        js_sys::Reflect::set(&path_obj, &"path".into(), &JsValue::from_str(&path_string))?;

        let color_obj = js_sys::Object::new();
        js_sys::Reflect::set(&color_obj, &"r".into(), &JsValue::from_f64(color.r as f64))?;
        js_sys::Reflect::set(&color_obj, &"g".into(), &JsValue::from_f64(color.g as f64))?;
        js_sys::Reflect::set(&color_obj, &"b".into(), &JsValue::from_f64(color.b as f64))?;

        js_sys::Reflect::set(&path_obj, &"color".into(), &color_obj)?;
        paths.push(&path_obj);
    }

    // Create result object
    let result = js_sys::Object::new();

    js_sys::Reflect::set(
        &result,
        &"paths".into(),
        &paths.into()
    )?;

    js_sys::Reflect::set(
        &result,
        &"width".into(),
        &JsValue::from_f64(width as f64)
    )?;

    js_sys::Reflect::set(
        &result,
        &"height".into(),
        &JsValue::from_f64(height as f64)
    )?;

    Ok(result.into())
}
