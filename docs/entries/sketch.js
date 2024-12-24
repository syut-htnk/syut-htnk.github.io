const sketch = (p) => {
    let img, sorted_img;
    let img_mask;
    let threshold = 130;
    let isVisibleMask = false;
    let isVertical = false;
    let isSortHighToLow = false;
    let customFont;

    p.preload = function () {
        img = p.loadImage('./assets/face.jpg');
        customFont = p.loadFont('assets/Arial.ttf');
    };

    p.setup = function () {
        const canvasElement = document.getElementById('p5js-canvas');
        p.createCanvas(canvasElement.width, canvasElement.height, p.WEBGL);
        img.resize(p.width, p.height);
        p.pixelDensity(1);
    };

    p.draw = function () {
        p.background(0);

        // WEBGL座標系での描画位置調整
        p.translate(-p.width / 2, -p.height / 2);

        // 元画像の描画
        // p.image(img, 0, 0);

        sorted_img = p.createImage(img.width, img.height);
        sorted_img.copy(img, 0, 0, img.width, img.height, 0, 0, img.width, img.height);
        img_mask = p.createImage(img.width, img.height);
        img_mask.copy(img, 0, 0, img.width, img.height, 0, 0, img.width, img.height);

        sorted_img = sortImagePixels(sorted_img, isVertical);

        // 処理後の画像の描画
        if (isVisibleMask) {
            p.image(createMask(img_mask), 0, 0);
        } else {
            p.image(sorted_img, 0, 0);
        }

        // threshold値の表示位置調整
        p.push();
        p.textFont(customFont);
        p.textSize(20);
        p.fill(255, 255, 0); // 黄色に変更
        p.textAlign(p.LEFT, p.TOP);
        p.text('Threshold: ' + threshold, 10, 10);
        p.pop();
    };

    /*
        * @img {p5.Image} 画像インスタンス
        * @x {Number} 画像内のx座標
        * @y {Number} 画像内のy座標
        * @returns {Array} [R, G, B, A]
        * 
        * 画像インスタンスの指定した座標のピクセル値を取得する
        * 例: getPixelAt(img, 0, 0);
        * 画像インスタンスの左上のピクセルの値を取得する
        */
    function getPixelAt(img, x, y) {
        const index = (y * img.width + x) * 4;
        return [
            img.pixels[index],
            img.pixels[index + 1],
            img.pixels[index + 2],
            img.pixels[index + 3]
        ];
    }

    /*
        * @img {p5.Image} 画像インスタンス
        * @x {Number} 画像内のx座標
        * @y {Number} 画像内のy座標
        * @pixel {Array} [R, G, B, A]
        * @returns {void}
        * 
        * 画像インスタンスの指定した座標にピクセルをセットする
        * 画像インスタンスのピクセル値を更新するため、updatePixels()が必要
        * 例: setPixelAt(img, 0, 0, [255, 0, 0, 255]);
        * 画像インスタンスの左上のピクセルを赤色に変更する
        */
    function setPixelAt(img, x, y, pixel) {
        const index = (y * img.width + x) * 4;
        img.pixels[index] = pixel[0];
        img.pixels[index + 1] = pixel[1];
        img.pixels[index + 2] = pixel[2];
        img.pixels[index + 3] = pixel[3];
    }

    /*
        * @pixel {Array} [R, G, B, A]
        * @returns {Number} 0 ~ 255
        *  
        * 画素の輝度を取得する
        * 例: getBrightness([255, 255, 255, 255]);
        * 白色の画素の輝度を取得する
        */
    function getBrightness(pixel) {
        return 0.2126 * pixel[0] + 0.7152 * pixel[1] + 0.0722 * pixel[2];
    }

    /*
        * @img {p5.Image} 画像インスタンス
        * @lineIndex {Number} 画像内の行番号
        * @vertical {Boolean} 縦方向の場合はtrue、横方向の場合はfalse
        * @returns {Array} [pixel1, pixel2, ...]
        * 
        * 画像インスタンスの指定した行のピクセル値を取得する
        * 例: getLine(img, 0, false);
        * 返り値: 画像インスタンスの上端の行のピクセル値の配列
        */
    function getLine(img, lineIndex, vertical) {
        const linePixels = [];
        const length = vertical ? img.height : img.width;

        for (let i = 0; i < length; i++) {
            const [x, y] = vertical ? [lineIndex, i] : [i, lineIndex];
            linePixels.push(getPixelAt(img, x, y));
        }
        return linePixels;
    }

    /*
        * @img {p5.Image} 画像インスタンス
        * @lineIndex {Number} 画像内の行番号
        * @pixels {Array} [pixel1, pixel2, ...]
        * @vertical {Boolean} 縦方向の場合はtrue、横方向の場合はfalse
        * @returns {void}
        * 
        * 画像インスタンスの指定した行にピクセルをセットする
        * 画像インスタンスのピクセル値を更新するため、updatePixels()が必要
        * 例: setLine(img, 0, [pixel1, pixel2, ...], false);
        */
    function setLine(img, lineIndex, pixels, vertical) {
        pixels.forEach((pixel, i) => {
            const [x, y] = vertical ? [lineIndex, i] : [i, lineIndex];
            setPixelAt(img, x, y, pixel);
        });
    }

    /*
        * @pixels {Array} [pixel1, pixel2, ...]
        * @returns {Array} [{mask: 0 or 255, pixels: [pixel1, pixel2, ...], startIndex: 0}, ...]
        * 
        * 画素のグループを作成する
        * 例: createPixelGroups([pixel1, pixel2, ...]);
        * 返り値: [{mask: 0 or 255, pixels: [pixel1, pixel2, ...], startIndex: 0}, ...]
        * 画素のグループの配列
            * mask: 0 or 255
            * pixels: 画素の配列
            * startIndex: 画素の配列の先頭のインデックス
        */
    function createPixelGroups(pixels) {
        const groups = [];
        let currentGroup = [];
        let currentMask = -1;

        pixels.forEach((pixel, index) => {
            const maskValue = getBrightness(pixel) > threshold ? 255 : 0;

            if (maskValue !== currentMask) {
                if (currentGroup.length > 0) {
                    groups.push({
                        mask: currentMask,
                        pixels: currentGroup,
                        startIndex: index - currentGroup.length
                    });
                }
                currentGroup = [];
                currentMask = maskValue;
            }
            currentGroup.push(pixel);
        });

        if (currentGroup.length > 0) {
            groups.push({
                mask: currentMask,
                pixels: currentGroup,
                startIndex: pixels.length - currentGroup.length
            });
        }

        return groups;
    }

    /*
        * @img {p5.Image} 画像インスタンス
        * @vertical {Boolean} 縦方向の場合はtrue、横方向の場合はfalse
        * @returns {p5.Image} 画像インスタンス
        * 
        * 画像の画素をソートする
        * 例: sortImagePixels(img, true);
        * 返り値: 縦方向に輝度の高い順にソートされた画像インスタンス
        */
    function sortImagePixels(img, vertical) {
        img.loadPixels();
        const length = vertical ? img.width : img.height;

        for (let i = 0; i < length; i++) {
            const linePixels = getLine(img, i, vertical);
            const groups = createPixelGroups(linePixels);

            groups.forEach(group => {
                if (group.mask === 255) {
                    if (isSortHighToLow) {
                        group.pixels.sort((a, b) => getBrightness(b) - getBrightness(a));
                    }
                    else {
                        group.pixels.sort((a, b) => getBrightness(a) - getBrightness(b));
                    }
                }
            });

            const sortedPixels = [];
            groups.forEach(group => {
                sortedPixels.push(...group.pixels);
            });

            setLine(img, i, sortedPixels, vertical);
        }

        img.updatePixels();
        return img;
    }

    /*
        * @img {p5.Image} 画像インスタンス
        * @returns {p5.Image} 画像インスタンス
        *
        * 画像のマスクを作成する
        * 例: createMask(img);
        * 返り値: 画像インスタンスのマスク
        * 画像インスタンスの輝度がthresholdより高い場合は白、それ以外は黒
        * 画像インスタンスのピクセル値を更新するため、updatePixels()が必要
        * 画像インスタンスのマスクを表示する場合はisVisibleMaskをtrueにする
        */
    function createMask(img) {
        img.loadPixels();

        for (let y = 0; y < img.height; y++) {
            for (let x = 0; x < img.width; x++) {
                const pixel = getPixelAt(img, x, y);
                const brightness = getBrightness(pixel);
                const maskValue = brightness > threshold ? 255 : 0;
                setPixelAt(img, x, y, [maskValue, maskValue, maskValue, 255]);
            }
        }

        img.updatePixels();
        return img;
    }

    p.keyPressed = function () {
        function toggleMask() {
            isVisibleMask = !isVisibleMask;
        }
        function toggleDirection() {
            isVertical = !isVertical;
        }
        function toggleSortOrder() {
            isSortHighToLow = !isSortHighToLow;
        }
        if (p.key === 'm' || p.key === 'M') {
            toggleMask();
        }
        if (p.key === 'v' || p.key === 'V') {
            toggleDirection();
        }
        if (p.key === 's' || p.key === 'S') {
            toggleSortOrder();
        }
        if (p.keyCode === p.UP_ARROW) {
            threshold = p.constrain(threshold + 5, 0, 255);
        }
        if (p.keyCode === p.DOWN_ARROW) {
            threshold = p.constrain(threshold - 5, 0, 255);
        }
    };
};

new p5(sketch, document.getElementById('p5js-canvas'));