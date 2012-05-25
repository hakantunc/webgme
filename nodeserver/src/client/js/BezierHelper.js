/*
 * BezierHelper utility to compute the shortest Bezier curve control points between two rectangle
 */
define([], function () {
    "use strict";

    var BezierHelper;

    BezierHelper = {
        getBezierControlPoints : function (boundingBox1, boundingBox2) {
            var bb1 = { x: boundingBox1.x,
                    y: boundingBox1.y,
                    width: boundingBox1.width,
                    height: boundingBox1.height },
                bb2 = { x: boundingBox2.x,
                    y: boundingBox2.y,
                    width: boundingBox2.width,
                    height: boundingBox2.height },
                p = [{x: bb1.x + bb1.width / 2, y: bb1.y},
                    {x: bb1.x + bb1.width / 2, y: bb1.y + bb1.height},
                    {x: bb1.x, y: bb1.y + bb1.height / 2},
                    {x: bb1.x + bb1.width, y: bb1.y + bb1.height / 2},
                    {x: bb2.x + bb2.width / 2, y: bb2.y},
                    {x: bb2.x + bb2.width / 2, y: bb2.y + bb2.height},
                    {x: bb2.x, y: bb2.y + bb2.height / 2},
                    {x: bb2.x + bb2.width, y: bb2.y + bb2.height / 2}],
                d = {},
                dis = [],
                i,
                j,
                res,
                dx,
                dy,
                x = [],
                y = [],
                result = [];

            if ((bb1.x !== bb2.x) && (bb1.y !== bb2.y)) {
                for (i = 0; i < 4; i += 1) {
                    for (j = 4; j < 8; j += 1) {
                        dx = Math.abs(p[i].x - p[j].x);
                        dy = Math.abs(p[i].y - p[j].y);
                        if ((i === j - 4) || (((i !== 3 && j !== 6) || p[i].x < p[j].x) && ((i !== 2 && j !== 7) || p[i].x > p[j].x) && ((i !== 0 && j !== 5) || p[i].y > p[j].y) && ((i !== 1 && j !== 4) || p[i].y < p[j].y))) {
                            dis.push(dx + dy);
                            d[dis[dis.length - 1]] = [i, j];
                        }
                    }
                }
                if (dis.length === 0) {
                    res = [0, 4];
                } else {
                    res = d[Math.min.apply(Math, dis)];
                }

                x[1] = p[res[0]].x;
                y[1] = p[res[0]].y;
                x[4] = p[res[1]].x;
                y[4] = p[res[1]].y;

                dx = Math.max(Math.abs(x[1] - x[4]) / 2, 10);
                dy = Math.max(Math.abs(y[1] - y[4]) / 2, 10);

                /*if (dx !== dy) {
                 if (dx === 10) {
                 dx = 50;
                 }
                 if (dy === 10) {
                 dy = 50;
                 }
                 }*/

                x[2] = [x[1], x[1], x[1] - dx, x[1] + dx][res[0]].toFixed(3);
                y[2] = [y[1] - dy, y[1] + dy, y[1], y[1]][res[0]].toFixed(3);
                x[3] = [0, 0, 0, 0, x[4], x[4], x[4] - dx, x[4] + dx][res[1]].toFixed(3);
                y[3] = [0, 0, 0, 0, y[1] + dy, y[1] - dy, y[4], y[4]][res[1]].toFixed(3);
            } else {
                //when the source and target of the connection is the same
                x[1] = p[1].x;
                y[1] = p[1].y;
                x[4] = p[7].x;
                y[4] = p[7].y;

                x[2] = bb1.x + bb1.width;
                y[2] = bb1.y + bb1.height * 1.5;

                x[3] = bb1.x + bb1.width * 1.5;
                y[3] = bb1.y + bb1.height;
            }




            result.push({"x": parseFloat(x[1].toFixed(3)), "y": parseFloat(y[1].toFixed(3))});
            result.push({"x": parseFloat(x[2]), "y": parseFloat(y[2])});
            result.push({"x": parseFloat(x[3]), "y": parseFloat(y[3])});
            result.push({"x": parseFloat(x[4].toFixed(3)), "y": parseFloat(y[4].toFixed(3))});

            return result;
        }
    };

    return BezierHelper;
});