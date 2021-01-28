/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import {
  SafeAreaView, StatusBar, Text
} from 'react-native';
import {toString} from 'lodash-es';
import {Svg, Path} from 'react-native-svg';

const App = () => {
  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView>
        <Text>{toString([1, 2])}</Text>
        <Svg
          width="130"
          height="130"
          fill="blue"
          stroke="red"
          color="green"
          viewBox="-16 -16 544 544">
          <Path
            d="M318.37,85.45L422.53,190.11,158.89,455,54.79,350.38ZM501.56,60.2L455.11,13.53a45.93,45.93,0,0,0-65.11,0L345.51,58.24,449.66,162.9l51.9-52.15A35.8,35.8,0,0,0,501.56,60.2ZM0.29,497.49a11.88,11.88,0,0,0,14.34,14.17l116.06-28.28L26.59,378.72Z"
            strokeWidth="32"
          />
          <Path d="M0,0L512,512" stroke="currentColor" strokeWidth="32" />
        </Svg>
      </SafeAreaView>
    </>
  );
};

export default App;
