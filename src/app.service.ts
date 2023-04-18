import { Injectable } from '@nestjs/common';
import Jimp from 'jimp';
import sharp from 'sharp';
import axios from 'axios';

@Injectable()
export class AppService {
  async main(fileUrl) {
    function getDitherValue(colors, variance) {
      const MAX_DITHER = 400;
      const maxDither = MAX_DITHER / Math.ceil(colors / 2);
      console.log(colors, (maxDither / 10) * variance);
      return (maxDither / 10) * variance;
    }

    function numberInBetween(number, min, max) {
      number = Math.max(min, number);
      return Math.min(max, number);
    }

    const start = performance.now();

    const image = await Jimp.read(fileUrl);

    image.resize(200, 200);

    const rgbArray = this.buildRgb(image.bitmap.data);

    const k = numberInBetween(4, 1, 16);
    const variance = numberInBetween(5, 0, 10);
    const kMeans = this.kMeansClusteringWithDithering(
      rgbArray,
      k,
      getDitherValue(k, variance),
    );

    const rgbPallete = kMeans.centroids;
    const hexPallete = this.convertRGBToHEX(rgbPallete);
    const hslPallete = this.convertRGBtoHSL(rgbPallete);

    console.log(hexPallete);
    console.log(hslPallete);

    // await clipboard.writeSync(JSON.stringify(rgbPallete));

    console.log(performance.now() - start);

    return rgbPallete;
  }

  convertRGBToHEX(rgbArray) {
    return rgbArray.map((pixel) => {
      const componentToHex = (c) => {
        const hex = c.toString(16);
        return hex.length == 1 ? '0' + hex : hex;
      };

      return (
        '#' +
        componentToHex(pixel.r) +
        componentToHex(pixel.g) +
        componentToHex(pixel.b)
      ).toUpperCase();
    });
  }

  /**
   * Convert RGB values to HSL
   * This formula can be
   * found here https://www.niwa.nu/2013/05/math-behind-colorspace-conversions-rgb-hsl/
   */
  convertRGBtoHSL(rgbValues) {
    return rgbValues.map(({ r, g, b }) => {
      (r /= 255), (g /= 255), (b /= 255);
      const max = Math.max(r, g, b),
        min = Math.min(r, g, b);
      let h,
        s,
        l = (max + min) / 2;

      if (max === min) {
        h = s = 0; // achromatic
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r:
            h = (g - b) / d + (g < b ? 6 : 0);
            break;
          case g:
            h = (b - r) / d + 2;
            break;
          case b:
            h = (r - g) / d + 4;
            break;
        }
        h /= 6;
      }
      return { h: h.toFixed(2), s: s.toFixed(2), l: l.toFixed(2) };
    });
  }

  kMeansClusteringWithDithering(colors, k, dither) {
    // Add dithering noise to each data point
    for (const d of colors) {
      d.r += (Math.random() - 0.5) * dither;
      d.g += (Math.random() - 0.5) * dither;
      d.b += (Math.random() - 0.5) * dither;
    }

    // Run k-means clustering on the data
    const { centroids, clusters } = this.kMeansClustering(colors, k);

    // Round the centroids to the nearest integer values
    const roundedCentroids = centroids.map((c) => ({
      r: Math.round(c.r),
      g: Math.round(c.g),
      b: Math.round(c.b),
    }));

    return { centroids: roundedCentroids, clusters };

    function areColorsEqual(c1, c2) {
      return c1.r === c2.r && c1.g === c2.g && c1.b === c2.b;
    }
  }

  buildRgb(imageData) {
    const rgbValues = [];
    // note that we are loopin every 4!
    // for every Red, Green, Blue and Alpha
    for (let i = 0; i < imageData.length; i += 4) {
      const rgb = {
        r: imageData[i],
        g: imageData[i + 1],
        b: imageData[i + 2],
      };

      rgbValues.push(rgb);
    }

    return rgbValues;
  }

  kMeansClustering(colors, k) {
    // Initialize centroids using k-means++
    // let centroids = [];
    // centroids.push(colors[Math.floor(Math.random() * colors.length)]);
    // while (centroids.length < k) {
    //     let distances = Array.from({ length: colors.length }, () => Infinity);
    //     for (let i = 0; i < colors.length; i++) {
    //         for (const centroid of centroids) {
    //             const dist = Math.sqrt(
    //                 (colors[i].r - centroid.r) ** 2 +
    //                 (colors[i].g - centroid.g) ** 2 +
    //                 (colors[i].b - centroid.b) ** 2
    //             );
    //             distances[i] = Math.min(distances[i], dist);
    //         }
    //     }
    //     const sumDistances = distances.reduce((acc, val) => acc + val);
    //     const probabilities = distances.map(d => d / sumDistances);
    //     let cumulativeProbability = 0;
    //     const rand = Math.random();
    //     for (let i = 0; i < probabilities.length; i++) {
    //         cumulativeProbability += probabilities[i];
    //         if (cumulativeProbability >= rand) {
    //             centroids.push(colors[i]);
    //             break;
    //         }
    //     }
    // }

    // Initialize centroids randomly
    const centroids = [];
    for (let i = 0; i < k; i++) {
      let idx;
      do {
        idx = Math.floor(Math.random() * colors.length);
      } while (
        centroids.some((centroid) => objectsEqual(colors[idx], centroid))
      );
      centroids.push(colors[idx]);
    }

    // Perform k-means clustering
    let clusters = Array.from({ length: k }, () => []);
    let oldCentroids;
    do {
      // Assign each color to the closest centroid
      for (const color of colors) {
        let minDist = Infinity;
        let closestCentroid;
        for (const centroid of centroids) {
          const dist = this.euclideanDistance(color, centroid);
          if (dist < minDist) {
            minDist = dist;
            closestCentroid = centroid;
          }
        }
        clusters[centroids.indexOf(closestCentroid)].push(color);
      }

      // Update the centroids
      oldCentroids = [...centroids];
      for (let i = 0; i < k; i++) {
        const cluster = clusters[i];
        if (cluster.length === 0) {
          // If a cluster is empty, reassign its centroid to a random color
          const idx = Math.floor(Math.random() * colors.length);
          centroids[i] = colors[idx];
        } else {
          const r =
            cluster.reduce((acc, color) => acc + color.r, 0) / cluster.length;
          const g =
            cluster.reduce((acc, color) => acc + color.g, 0) / cluster.length;
          const b =
            cluster.reduce((acc, color) => acc + color.b, 0) / cluster.length;
          centroids[i] = { r, g, b };
        }
      }

      // Clear the clusters for the next iteration
      clusters = Array.from({ length: k }, () => []);
    } while (!centroids.every((c, i) => objectsEqual(c, oldCentroids[i])));

    // Helper function to compare two objects
    function objectsEqual(a, b) {
      return a.r === b.r && a.g === b.g && a.b === b.b;
    }

    // Return the final centroids and clusters
    return { centroids, clusters };
  }

  euclideanDistance(color1, color2) {
    return Math.sqrt(
      (color1.r - color2.r) ** 2 +
        (color1.g - color2.g) ** 2 +
        (color1.b - color2.b) ** 2,
    );
  }
}
