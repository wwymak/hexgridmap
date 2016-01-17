var path = require('path'),
    webpack = require('webpack');
module.exports = {
    entry: {
        filename: ['./index.js']
    },
    //output: {
    //    filename: './dest/bundle.js'
    //},
    output: {
        path: path.join(__dirname, 'dest'),
        publicPath: './dest/',
        filename: "bundle.js",
        sourceMapFilename: "[file].map"
    },
    cache: true,
    devtool: 'source-map',
    module: {
        loaders: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                loader: 'babel',
                query: {
                    presets: ['es2015']
                }
            },
            {
                test:   /\.(png|gif|jpe?g|svg)$/i,
                loader: 'url',
            },
        ],

    }
};
